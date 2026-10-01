const Model = require('objection').Model

/**
 * Pages and folders watched by users (e-mail notifications)
 */
module.exports = class UserWatch extends Model {
  static get tableName () { return 'userWatches' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['userId', 'kind'],

      properties: {
        id: { type: 'integer' },
        userId: { type: 'integer' },
        kind: { type: 'string', enum: ['page', 'path'] },
        pageId: { type: 'integer' },
        localeCode: { type: 'string' },
        path: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  }

  $beforeInsert () {
    this.createdAt = new Date().toISOString()
  }
}
