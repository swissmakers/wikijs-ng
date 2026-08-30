const { pipeline } = require('node:stream/promises')
const { Transform } = require('node:stream')

/* global WIKI */

/**
 * Build a boolean-mode query string with prefix matching, e.g. `+install* +docker*`
 */
function buildBooleanQuery (q) {
  return q
    .split(/\s+/)
    .map(t => t.replace(/[+\-<>()~*"@]/g, ''))
    .filter(t => t.length > 1)
    .map(t => `+${t}*`)
    .join(' ')
}

module.exports = {
  async activate () {
    if (WIKI.config.db.type !== 'mariadb' && WIKI.config.db.type !== 'mysql') {
      throw new WIKI.Error.SearchActivationFailed('Must use MariaDB or MySQL database to activate this engine!')
    }
  },
  async deactivate () {
    WIKI.logger.info(`(SEARCH/MARIADB) Dropping index table...`)
    await WIKI.models.knex.schema.dropTableIfExists('pagesSearch')
    WIKI.logger.info(`(SEARCH/MARIADB) Index table has been dropped.`)
  },
  /**
   * INIT
   */
  async init () {
    WIKI.logger.info(`(SEARCH/MARIADB) Initializing...`)

    const indexExists = await WIKI.models.knex.schema.hasTable('pagesSearch')
    if (!indexExists) {
      WIKI.logger.info(`(SEARCH/MARIADB) Creating Pages Search table...`)
      await WIKI.models.knex.raw(`
        CREATE TABLE \`pagesSearch\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          \`path\` VARCHAR(255) NOT NULL,
          \`locale\` VARCHAR(10) NOT NULL,
          \`title\` VARCHAR(255) NULL,
          \`description\` TEXT NULL,
          \`content\` LONGTEXT NULL,
          UNIQUE KEY \`pagesSearch_path_locale\` (\`path\`, \`locale\`),
          FULLTEXT KEY \`ft_all\` (\`title\`, \`description\`, \`content\`),
          FULLTEXT KEY \`ft_title\` (\`title\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    }

    WIKI.logger.info(`(SEARCH/MARIADB) Initialization completed.`)
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query (q, opts) {
    try {
      const filters = []
      const filterParams = []
      if (opts.locale) {
        filters.push('AND `locale` = ?')
        filterParams.push(opts.locale)
      }
      if (opts.path) {
        filters.push('AND `path` LIKE ?')
        filterParams.push(`${opts.path}%`)
      }
      const filterQry = filters.join(' ')

      const runQuery = async (matchExpr, matchParam) => {
        const rows = await WIKI.models.knex.raw(`
          SELECT \`id\`, \`path\`, \`locale\`, \`title\`, \`description\`,
            (3 * MATCH(\`title\`) AGAINST(${matchExpr}) + MATCH(\`title\`, \`description\`, \`content\`) AGAINST(${matchExpr})) AS \`relevance\`
          FROM \`pagesSearch\`
          WHERE MATCH(\`title\`, \`description\`, \`content\`) AGAINST(${matchExpr}) ${filterQry}
          ORDER BY \`relevance\` DESC
          LIMIT ?
        `, [matchParam, matchParam, matchParam, ...filterParams, WIKI.config.search.maxHits])
        const totals = await WIKI.models.knex.raw(`
          SELECT COUNT(*) AS \`total\` FROM \`pagesSearch\`
          WHERE MATCH(\`title\`, \`description\`, \`content\`) AGAINST(${matchExpr}) ${filterQry}
        `, [matchParam, ...filterParams])
        return {
          rows: rows[0],
          totalHits: parseInt(totals[0][0].total, 10)
        }
      }

      // -> Natural language first, boolean-mode prefix matching as fallback (partial words)
      let { rows, totalHits } = await runQuery('? IN NATURAL LANGUAGE MODE', q)
      const boolQuery = buildBooleanQuery(q)
      if (rows.length < 1 && boolQuery.length > 0) {
        ({ rows, totalHits } = await runQuery('? IN BOOLEAN MODE', boolQuery))
      }

      // -> Title-based suggestions when few results
      let suggestions = []
      if (rows.length < 5 && boolQuery.length > 0) {
        const suggestResults = await WIKI.models.knex.raw(`
          SELECT DISTINCT \`title\` FROM \`pagesSearch\`
          WHERE MATCH(\`title\`) AGAINST(? IN BOOLEAN MODE)
          LIMIT 5
        `, [boolQuery])
        suggestions = suggestResults[0].map(r => r.title).filter(t => !rows.some(row => row.title === t))
      }

      return {
        results: rows,
        suggestions,
        totalHits
      }
    } catch (err) {
      WIKI.logger.warn('Search Engine Error:')
      WIKI.logger.warn(err)
      return {
        results: [],
        suggestions: [],
        totalHits: 0
      }
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created (page) {
    await WIKI.models.knex('pagesSearch').insert({
      path: page.path,
      locale: page.localeCode,
      title: page.title,
      description: page.description,
      content: page.safeContent
    }).onConflict(['path', 'locale']).merge()
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated (page) {
    await WIKI.models.knex('pagesSearch').insert({
      path: page.path,
      locale: page.localeCode,
      title: page.title,
      description: page.description,
      content: page.safeContent
    }).onConflict(['path', 'locale']).merge()
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted (page) {
    await WIKI.models.knex('pagesSearch').where({
      locale: page.localeCode,
      path: page.path
    }).del()
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed (page) {
    await WIKI.models.knex('pagesSearch').where({
      locale: page.localeCode,
      path: page.path
    }).update({
      locale: page.destinationLocaleCode,
      path: page.destinationPath
    })
  },
  /**
   * REBUILD INDEX
   */
  async rebuild () {
    WIKI.logger.info(`(SEARCH/MARIADB) Rebuilding Index...`)
    await WIKI.models.knex('pagesSearch').truncate()

    let chunk = []
    const flushChunk = async () => {
      if (chunk.length > 0) {
        await WIKI.models.knex('pagesSearch').insert(chunk)
        chunk = []
      }
    }

    await pipeline(
      WIKI.models.knex.column('path', 'localeCode', 'title', 'description', 'render').select().from('pages').where({
        isPublished: true,
        isPrivate: false,
        isTemplate: false
      }).stream(),
      new Transform({
        objectMode: true,
        transform: async (page, enc, cb) => {
          try {
            chunk.push({
              path: page.path,
              locale: page.localeCode,
              title: page.title,
              description: page.description,
              content: WIKI.models.pages.cleanHTML(page.render)
            })
            if (chunk.length >= 50) {
              await flushChunk()
            }
            cb()
          } catch (err) {
            cb(err)
          }
        }
      })
    )
    await flushChunk()

    WIKI.logger.info(`(SEARCH/MARIADB) Index rebuilt successfully.`)
  }
}
