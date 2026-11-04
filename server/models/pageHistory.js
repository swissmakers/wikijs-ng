const Model = require('objection').Model
const _ = require('lodash')
const { DateTime, Duration } = require('luxon')

/* global WIKI */

/**
 * Page History model
 */
module.exports = class PageHistory extends Model {
  static get tableName () { return 'pageHistory' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'title'],

      properties: {
        id: { type: 'integer' },
        path: { type: 'string' },
        hash: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        isPublished: { type: 'boolean' },
        publishStartDate: { type: 'string' },
        publishEndDate: { type: 'string' },
        content: { type: 'string' },
        contentType: { type: 'string' },

        createdAt: { type: 'string' }
      }
    }
  }

  static get relationMappings () {
    return {
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./tags'),
        join: {
          from: 'pageHistory.id',
          through: {
            from: 'pageHistoryTags.pageId',
            to: 'pageHistoryTags.tagId'
          },
          to: 'tags.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'pageHistory.pageId',
          to: 'pages.id'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageHistory.authorId',
          to: 'users.id'
        }
      },
      editor: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./editors'),
        join: {
          from: 'pageHistory.editorKey',
          to: 'editors.key'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'pageHistory.localeCode',
          to: 'locales.code'
        }
      }
    }
  }

  $beforeInsert () {
    this.createdAt = new Date().toISOString()
  }

  /**
   * Create Page Version
   */
  static async addVersion (opts) {
    await WIKI.models.pageHistory.query().insert({
      pageId: opts.id,
      authorId: opts.authorId,
      content: opts.content,
      contentType: opts.contentType,
      description: opts.description,
      editorKey: opts.editorKey,
      hash: opts.hash,
      isPrivate: (opts.isPrivate === true || opts.isPrivate === 1),
      isPublished: (opts.isPublished === true || opts.isPublished === 1),
      localeCode: opts.localeCode,
      path: opts.path,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      action: opts.action || 'updated',
      versionDate: opts.versionDate
    })
  }

  /**
   * Get Page Version
   */
  static async getVersion ({ pageId, versionId }) {
    const version = await WIKI.models.pageHistory.query()
      .column([
        'pageHistory.path',
        'pageHistory.title',
        'pageHistory.description',
        'pageHistory.isPrivate',
        'pageHistory.isPublished',
        'pageHistory.publishStartDate',
        'pageHistory.publishEndDate',
        'pageHistory.content',
        'pageHistory.contentType',
        'pageHistory.createdAt',
        'pageHistory.action',
        'pageHistory.authorId',
        'pageHistory.pageId',
        'pageHistory.versionDate',
        {
          versionId: 'pageHistory.id',
          editor: 'pageHistory.editorKey',
          locale: 'pageHistory.localeCode',
          authorName: 'author.name'
        }
      ])
      .joinRelated('author')
      .where({
        'pageHistory.id': versionId,
        'pageHistory.pageId': pageId
      }).first()
    if (version) {
      return {
        ...version,
        updatedAt: version.createdAt || null,
        tags: []
      }
    } else {
      return null
    }
  }

  /**
   * Get History Trail of a Page
   */
  static async getHistory ({ pageId, offsetPage = 0, offsetSize = 100 }) {
    const history = await WIKI.models.pageHistory.query()
      .column([
        'pageHistory.id',
        'pageHistory.path',
        'pageHistory.authorId',
        'pageHistory.action',
        'pageHistory.versionDate',
        {
          authorName: 'author.name'
        }
      ])
      .joinRelated('author')
      .where({
        'pageHistory.pageId': pageId
      })
      .orderBy('pageHistory.versionDate', 'desc')
      .page(offsetPage, offsetSize)

    let prevPh = null
    const upperLimit = (offsetPage + 1) * offsetSize

    if (history.total >= upperLimit) {
      prevPh = await WIKI.models.pageHistory.query()
        .column([
          'pageHistory.id',
          'pageHistory.path',
          'pageHistory.authorId',
          'pageHistory.action',
          'pageHistory.versionDate',
          {
            authorName: 'author.name'
          }
        ])
        .joinRelated('author')
        .where({
          'pageHistory.pageId': pageId
        })
        .orderBy('pageHistory.versionDate', 'desc')
        .offset((offsetPage + 1) * offsetSize)
        .limit(1)
        .first()
    }

    return {
      trail: _.reduce(_.reverse(history.results), (res, ph) => {
        let actionType = 'edit'
        let valueBefore = null
        let valueAfter = null

        if (!prevPh && history.total < upperLimit) {
          actionType = 'initial'
        } else if (_.get(prevPh, 'path', '') !== ph.path) {
          actionType = 'move'
          valueBefore = _.get(prevPh, 'path', '')
          valueAfter = ph.path
        }

        res.unshift({
          versionId: ph.id,
          authorId: ph.authorId,
          authorName: ph.authorName,
          actionType,
          valueBefore,
          valueAfter,
          versionDate: ph.versionDate
        })

        prevPh = ph
        return res
      }, []),
      total: history.total
    }
  }

  /**
   * Render a page version to HTML without saving anything
   *
   * Runs the rendering pipeline of the page in-process with the version content.
   * Links are resolved against the current location of the page.
   *
   * @param {Object} opts Options
   * @param {number} opts.pageId Page ID
   * @param {number} opts.versionId Version ID, 0 for the live page
   */
  static async renderVersion ({ pageId, versionId }) {
    const page = await WIKI.models.pages.query().findById(pageId)
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }
    if (versionId === 0) {
      return page.render || ''
    }
    const version = await WIKI.models.pageHistory.getVersion({ pageId, versionId })
    if (!version) {
      throw new WIKI.Error.PageNotFound()
    }
    if (_.isEmpty(WIKI.data.renderers)) {
      await WIKI.models.renderers.fetchDefinitions()
    }
    const pipeline = await WIKI.models.renderers.getRenderingPipeline(version.contentType || page.contentType)
    let output = version.content || ''
    for (const core of pipeline) {
      const renderer = require(`../modules/rendering/${_.kebabCase(core.key)}/renderer.js`)
      output = await renderer.render.call({
        config: core.config,
        children: core.children,
        page,
        input: output,
        preview: true
      })
    }
    return output
  }

  /**
   * Restore a page version on top of the live page
   *
   * Only the content is restored: the page keeps its current location and tags.
   * The overwritten live state becomes a new history entry, so a restore can itself be undone.
   *
   * @param {Object} opts Options
   * @param {number} opts.pageId Page ID
   * @param {number} opts.versionId Version ID to restore
   * @param {Object} opts.user Acting user
   */
  static async restoreVersion ({ pageId, versionId, user }) {
    const version = await WIKI.models.pageHistory.getVersion({ pageId, versionId })
    if (!version) {
      throw new WIKI.Error.PageNotFound()
    }
    return WIKI.models.pages.updatePage({
      id: pageId,
      content: version.content,
      title: version.title,
      description: version.description,
      isPublished: version.isPublished === true || version.isPublished === 1,
      publishStartDate: version.publishStartDate,
      publishEndDate: version.publishEndDate,
      user,
      action: 'restored'
    })
  }

  /**
   * Work out how to roll a page back to the state it had before a given date
   *
   * Every history entry is a past state of the page (created at versionDate by authorId),
   * the live page is the latest state. The baseline is the last state older than `since`.
   *
   * @param {Object} opts Options
   * @param {Object} opts.page Live page (authorId, authorName, updatedAt)
   * @param {Array} opts.versions History entries (id, authorId, authorName, versionDate)
   * @param {number} opts.authorId User whose changes are rolled back
   * @param {Date} opts.since Changes made at or after this date are rolled back
   * @param {boolean} [opts.includeOthers] Also roll back changes made by other users since then
   * @returns {Object} status (untouched, created, conflict, revert), baseline, changes and otherAuthors
   */
  static planRevert ({ page, versions, authorId, since, includeOthers = false }) {
    const states = _.sortBy([
      ..._.map(versions, v => ({ versionId: v.id, authorId: v.authorId, authorName: v.authorName, date: new Date(v.versionDate) })),
      { versionId: 0, authorId: page.authorId, authorName: page.authorName, date: new Date(page.updatedAt) }
    ], s => s.date.getTime())
    const changes = _.filter(states, s => s.date >= since)
    const baseline = _.findLast(states, s => s.date < since) || null
    const otherAuthors = _.uniq(_.map(_.filter(changes, s => s.authorId !== authorId), 'authorName'))

    let status = 'revert'
    if (!_.some(changes, ['authorId', authorId])) {
      status = 'untouched'
    } else if (!baseline) {
      status = 'created'
    } else if (otherAuthors.length > 0 && !includeOthers) {
      status = 'conflict'
    }
    return { status, baseline, changes: changes.length, otherAuthors }
  }

  /**
   * Roll back all changes a user made since a given date, page by page
   *
   * @param {Object} opts Options
   * @param {number} opts.authorId User whose changes are rolled back
   * @param {string} opts.since ISO date: changes made at or after it are rolled back
   * @param {string} [opts.pathPrefix] Only consider pages below this path
   * @param {boolean} [opts.includeOthers] Also roll back pages that other users edited since then
   * @param {Array<number>} [opts.pageIds] Only revert these pages (selection from a dry run)
   * @param {boolean} opts.dryRun Only report what would be done
   * @param {Object} opts.user Acting user
   */
  static async revertChanges ({ authorId, since, pathPrefix = '', includeOthers = false, pageIds = null, dryRun = true, user }) {
    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      throw new Error('Invalid start date.')
    }
    const prefix = _.trim(pathPrefix || '', '/ ')
    const isRecent = d => new Date(d) >= sinceDate

    // -> Pages the user changed since then: either the live state or an overwritten one is theirs
    const liveIds = _.map(_.filter(await WIKI.models.pages.query().select('id', 'updatedAt').where('authorId', authorId), p => isRecent(p.updatedAt)), 'id')
    const histIds = _.map(_.filter(await WIKI.models.pageHistory.query().select('pageId', 'versionDate').where('authorId', authorId), v => isRecent(v.versionDate)), 'pageId')
    let candidateIds = _.uniq([...liveIds, ...histIds])
    if (_.isArray(pageIds)) {
      candidateIds = _.intersection(candidateIds, pageIds)
    }

    const items = []
    for (const pageId of candidateIds) {
      const page = await WIKI.models.pages.query()
        .column(['pages.id', 'pages.path', 'pages.localeCode', 'pages.title', 'pages.authorId', 'pages.updatedAt', { authorName: 'author.name' }])
        .leftJoinRelated('author')
        .findById(pageId)
      if (!page || (prefix && page.path !== prefix && !_.startsWith(page.path, `${prefix}/`))) {
        continue
      }
      const versions = await WIKI.models.pageHistory.query()
        .column(['pageHistory.id', 'pageHistory.authorId', 'pageHistory.versionDate', { authorName: 'author.name' }])
        .leftJoinRelated('author')
        .where('pageHistory.pageId', pageId)
      const plan = WIKI.models.pageHistory.planRevert({ page, versions, authorId, since: sinceDate, includeOthers })
      if (plan.status === 'untouched') {
        continue
      }

      const item = {
        pageId: page.id,
        path: page.path,
        locale: page.localeCode,
        title: page.title,
        status: plan.status,
        changes: plan.changes,
        otherAuthors: plan.otherAuthors,
        baselineVersionId: _.get(plan, 'baseline.versionId', null),
        baselineDate: plan.baseline ? plan.baseline.date.toISOString() : null,
        message: ''
      }
      if (!dryRun && plan.status === 'revert') {
        try {
          await WIKI.models.pageHistory.restoreVersion({ pageId: page.id, versionId: item.baselineVersionId, user })
          item.status = 'reverted'
        } catch (err) {
          item.status = 'failed'
          item.message = err.message
          WIKI.logger.warn(`Failed to revert page ${page.id}: ${err.message}`)
        }
      }
      items.push(item)
    }
    return _.sortBy(items, ['locale', 'path'])
  }

  /**
   * Purge history older than X
   *
   * @param {String} olderThan ISO 8601 Duration
   */
  static async purge (olderThan) {
    const dur = Duration.fromISO(olderThan)
    const olderThanISO = DateTime.utc().minus(dur)
    await WIKI.models.pageHistory.query().where('versionDate', '<', olderThanISO.toISO()).del()
  }
}
