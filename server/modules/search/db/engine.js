/* global WIKI */

module.exports = {
  activate() {
    // not used
  },
  deactivate() {
    // not used
  },
  /**
   * INIT
   */
  init() {
    // not used
  },
  /**
   * QUERY
   *
   * @param {String} q Query
   * @param {Object} opts Additional options
   */
  async query(q, opts) {
    const likeOperator = WIKI.config.db.type === 'postgres' ? 'ILIKE' : 'LIKE'
    const tokens = q.trim().split(/\s+/).filter(t => t.length > 0)
    const applyFilters = builder => {
      builder.where('isPublished', true)
      builder.andWhere('isTemplate', false)
      if (opts.locale) {
        builder.andWhere('localeCode', opts.locale)
      }
      if (opts.path) {
        builder.andWhere('path', 'like', `${opts.path}%`)
      }
      // -> All tokens must match, each in any of the searched columns
      tokens.forEach(token => {
        builder.andWhere(builderSub => {
          builderSub.where('title', likeOperator, `%${token}%`)
          builderSub.orWhere('description', likeOperator, `%${token}%`)
          builderSub.orWhere('path', likeOperator, `%${token.toLowerCase()}%`)
        })
      })
    }
    const results = await WIKI.models.pages.query()
      .column('pages.id', 'title', 'description', 'path', 'localeCode as locale')
      .withGraphJoined('tags') // Adding page tags since they can be used to check resource access permissions
      .modifyGraph('tags', builder => {
        builder.select('tag')
      })
      .where(applyFilters)
      .orderByRaw(`CASE WHEN title ${likeOperator} ? THEN 0 WHEN description ${likeOperator} ? THEN 1 ELSE 2 END, title`, [`%${q}%`, `%${q}%`])
      .limit(WIKI.config.search.maxHits)
    const totalHitsResult = await WIKI.models.pages.query()
      .countDistinct('pages.id as total')
      .where(applyFilters)
      .first()
    let suggestions = []
    if (results.length < 5 && tokens.length > 0) {
      const suggestResults = await WIKI.models.pages.query()
        .distinct('title')
        .where('isPublished', true)
        .andWhere('title', likeOperator, `${tokens[0]}%`)
        .limit(5)
      suggestions = suggestResults.map(r => r.title).filter(t => !results.some(row => row.title === t))
    }
    return {
      results,
      suggestions,
      totalHits: parseInt(totalHitsResult.total, 10)
    }
  },
  /**
   * CREATE
   *
   * @param {Object} page Page to create
   */
  async created(page) {
    // not used
  },
  /**
   * UPDATE
   *
   * @param {Object} page Page to update
   */
  async updated(page) {
    // not used
  },
  /**
   * DELETE
   *
   * @param {Object} page Page to delete
   */
  async deleted(page) {
    // not used
  },
  /**
   * RENAME
   *
   * @param {Object} page Page to rename
   */
  async renamed(page) {
    // not used
  },
  /**
   * REBUILD INDEX
   */
  async rebuild() {
    // not used
  }
}
