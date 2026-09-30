const Model = require('objection').Model
const _ = require('lodash')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * CommentProvider model
 */
module.exports = class CommentProvider extends Model {
  static get tableName() { return 'commentProviders' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getProviders(isEnabled) {
    const providers = await WIKI.models.commentProviders.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['key'])
  }

  static async refreshProvidersFromDisk() {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'comments',
      dataKey: 'commentProviders',
      model: 'commentProviders',
      label: 'comment providers',
      isEnabledDefault: def => def.key === 'default'
    })
  }

  static async initProvider() {
    const commentProvider = await WIKI.models.commentProviders.query().findOne('isEnabled', true)
    if (commentProvider) {
      WIKI.data.commentProvider = {
        ..._.find(WIKI.data.commentProviders, ['key', commentProvider.key]),
        head: '',
        bodyStart: '',
        bodyEnd: '',
        main: '<comments></comments>'
      }

      if (WIKI.data.commentProvider.codeTemplate) {
        const template = await commonHelper.readModuleCodeTemplate({ dirName: 'comments', key: commentProvider.key, fields: ['head', 'body', 'main'] })
        const code = commonHelper.renderCodeTemplate(template, commentProvider.config)

        WIKI.data.commentProvider.head = code.head
        WIKI.data.commentProvider.body = code.body
        WIKI.data.commentProvider.main = code.main
      } else {
        WIKI.data.commentProvider = {
          ...WIKI.data.commentProvider,
          ...require(`../modules/comments/${commentProvider.key}/comment`),
          config: commentProvider.config
        }
        await WIKI.data.commentProvider.init()
      }
      WIKI.data.commentProvider.config = commentProvider.config
    }
  }
}
