const Model = require('objection').Model
const _ = require('lodash')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Analytics model
 */
module.exports = class Analytics extends Model {
  static get tableName() { return 'analytics' }
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
    const providers = await WIKI.models.analytics.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['key'])
  }

  static async refreshProvidersFromDisk() {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'analytics',
      dataKey: 'analytics',
      model: 'analytics',
      label: 'analytics providers'
    })
  }

  static async getCode ({ cache = false } = {}) {
    if (cache) {
      const analyticsCached = await WIKI.cache.get('analytics')
      if (analyticsCached) {
        return analyticsCached
      }
    }
    try {
      const analyticsCode = {
        head: '',
        bodyStart: '',
        bodyEnd: ''
      }
      const providers = await WIKI.models.analytics.getProviders(true)

      for (let provider of providers) {
        const template = await commonHelper.readModuleCodeTemplate({ dirName: 'analytics', key: provider.key, fields: ['head', 'bodyStart', 'bodyEnd'] })
        const code = commonHelper.renderCodeTemplate(template, provider.config)

        analyticsCode.head += code.head
        analyticsCode.bodyStart += code.bodyStart
        analyticsCode.bodyEnd += code.bodyEnd
      }

      await WIKI.cache.set('analytics', analyticsCode, 300)

      return analyticsCode
    } catch (err) {
      WIKI.logger.warn('Error while getting analytics code: ', err)
      return {
        head: '',
        bodyStart: '',
        bodyEnd: ''
      }
    }
  }
}
