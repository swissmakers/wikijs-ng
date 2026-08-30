const Model = require('objection').Model
const moment = require('moment')

/* global WIKI */

/**
 * PageDraft model
 */
module.exports = class PageDraft extends Model {
  static get tableName() { return 'pageDrafts' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'localeCode', 'editorKey'],

      properties: {
        id: {type: 'integer'},
        pageId: {type: ['integer', 'null']},
        path: {type: 'string'},
        localeCode: {type: 'string'},
        title: {type: 'string'},
        description: {type: 'string'},
        content: {type: 'string'},
        editorKey: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageDrafts.authorId',
          to: 'users.id'
        }
      }
    }
  }

  async $beforeUpdate(opt, context) {
    await super.$beforeUpdate(opt, context)

    this.updatedAt = moment.utc().toISOString()
  }
  async $beforeInsert(context) {
    await super.$beforeInsert(context)

    this.createdAt = moment.utc().toISOString()
    this.updatedAt = moment.utc().toISOString()
  }

  /**
   * Save (upsert) a draft for the given user + path + locale
   */
  static async saveDraft(opts) {
    const existing = await WIKI.models.pageDrafts.query().findOne({
      authorId: opts.authorId,
      path: opts.path,
      localeCode: opts.localeCode
    })
    if (existing) {
      await WIKI.models.pageDrafts.query().patch({
        pageId: opts.pageId || null,
        title: opts.title,
        description: opts.description,
        content: opts.content,
        editorKey: opts.editorKey
      }).findById(existing.id)
    } else {
      await WIKI.models.pageDrafts.query().insert({
        authorId: opts.authorId,
        pageId: opts.pageId || null,
        path: opts.path,
        localeCode: opts.localeCode,
        title: opts.title,
        description: opts.description,
        content: opts.content,
        editorKey: opts.editorKey
      })
    }
  }
}
