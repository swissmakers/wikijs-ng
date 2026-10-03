const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

/**
 * Page activity log (recent changes, RSS feed, watch notifications)
 */
module.exports = class PageActivity extends Model {
  static get tableName () { return 'pageActivity' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['pageId', 'localeCode', 'path', 'action'],

      properties: {
        id: { type: 'integer' },
        pageId: { type: 'integer' },
        localeCode: { type: 'string' },
        path: { type: 'string' },
        title: { type: 'string' },
        action: { type: 'string' },
        previousPath: { type: ['string', 'null'] },
        previousLocaleCode: { type: ['string', 'null'] },
        authorId: { type: ['integer', 'null'] },
        authorName: { type: 'string' },
        isPublished: { type: 'boolean' },
        isTemplate: { type: 'boolean' },
        isSync: { type: 'boolean' },
        notifyClaim: { type: ['string', 'null'] },
        createdAt: { type: 'string' }
      }
    }
  }

  $beforeInsert () {
    this.createdAt = new Date().toISOString()
  }

  /**
   * Record a page event. Never throws: a failure must not break the page operation.
   *
   * @param {Object} opts Options
   * @param {string} opts.action created, updated, restored, moved or deleted
   * @param {Object} opts.page Page (id, localeCode, path, title, isPublished, isTemplate)
   * @param {Object} opts.user Acting user
   * @param {Object} [opts.previous] Previous location of a moved page ({ path, localeCode })
   * @param {Boolean} [opts.isSync] Change made by a storage sync (git, disk), never notified
   */
  static async record ({ action, page, user, previous = null, isSync = false }) {
    try {
      await WIKI.models.pageActivity.query().insert({
        pageId: page.id,
        localeCode: page.localeCode,
        path: page.path,
        title: page.title || '',
        action,
        previousPath: _.get(previous, 'path', null),
        previousLocaleCode: _.get(previous, 'localeCode', null),
        authorId: _.get(user, 'id', null),
        authorName: _.get(user, 'name', '') || '',
        isPublished: page.isPublished === true || page.isPublished === 1,
        isTemplate: page.isTemplate === true || page.isTemplate === 1,
        isSync: isSync === true
      })
    } catch (err) {
      WIKI.logger.warn(`Failed to record page activity for page ${page.id}: ${err.message}`)
    }
  }
}
