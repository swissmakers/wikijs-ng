const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
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
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/analytics', provider.key, 'code.yml'), 'utf8')
        let code = yaml.load(def)
        code.head = _.defaultTo(code.head, '')
        code.bodyStart = _.defaultTo(code.bodyStart, '')
        code.bodyEnd = _.defaultTo(code.bodyEnd, '')

        _.forOwn(provider.config, (value, key) => {
          code.head = _.replace(code.head, new RegExp(`{{${key}}}`, 'g'), value)
          code.bodyStart = _.replace(code.bodyStart, `{{${key}}}`, value)
          code.bodyEnd = _.replace(code.bodyEnd, `{{${key}}}`, value)
        })

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
