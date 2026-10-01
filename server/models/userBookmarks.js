const Model = require('objection').Model

/**
 * Pages bookmarked by users
 */
module.exports = class UserBookmark extends Model {
  static get tableName () { return 'userBookmarks' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['userId', 'pageId'],

      properties: {
        id: { type: 'integer' },
        userId: { type: 'integer' },
        pageId: { type: 'integer' },
        createdAt: { type: 'string' }
      }
    }
  }

  $beforeInsert () {
    this.createdAt = new Date().toISOString()
  }
}
