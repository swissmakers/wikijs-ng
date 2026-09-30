const Model = require('objection').Model
const _ = require('lodash')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Logger model
 */
module.exports = class Logger extends Model {
  static get tableName() { return 'loggers' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        level: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getLoggers() {
    return WIKI.models.loggers.query()
  }

  static async refreshLoggersFromDisk() {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'logging',
      dataKey: 'loggers',
      model: 'loggers',
      label: 'loggers',
      isEnabledDefault: def => def.key === 'console'
    })
  }

  static async pageEvent({ event, page }) {
    const loggers = await WIKI.models.storage.query().where('isEnabled', true)
    if (loggers && loggers.length > 0) {
      _.forEach(loggers, logger => {
        WIKI.queue.job.syncStorage.add({
          event,
          logger,
          page
        }, {
          removeOnComplete: true
        })
      })
    }
  }
}
