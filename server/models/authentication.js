const Model = require('objection').Model
const _ = require('lodash')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Authentication model
 */
module.exports = class Authentication extends Model {
  static get tableName () { return 'authentication' }
  static get idColumn () { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key'],

      properties: {
        key: { type: 'string' },
        selfRegistration: { type: 'boolean' }
      }
    }
  }

  static get jsonAttributes () {
    return ['config', 'domainWhitelist', 'autoEnrollGroups']
  }

  static async getStrategy (key) {
    return WIKI.models.authentication.query().findOne({ key })
  }

  static async getStrategies () {
    const strategies = await WIKI.models.authentication.query().orderBy('order')
    return strategies.map(str => ({
      ...str,
      domainWhitelist: _.get(str.domainWhitelist, 'v', []),
      autoEnrollGroups: _.get(str.autoEnrollGroups, 'v', [])
    }))
  }

  static async refreshStrategiesFromDisk () {
    try {
      const dbStrategies = await WIKI.models.authentication.query()

      // -> Fetch definitions from disk
      await commonHelper.loadModuleDefinitions({ dirName: 'authentication', dataKey: 'authentication' })

      // -> Remove strategies whose module is gone (disabled only while users still reference them)
      await commonHelper.removeMissingModules({
        model: 'authentication',
        records: dbStrategies,
        keyField: 'strategyKey',
        isPresent: strategy => _.some(WIKI.data.authentication, ['key', strategy.strategyKey]),
        references: [{ table: 'users', column: 'providerKey' }]
      })

      for (const strategy of dbStrategies) {
        let newProps = false
        const strategyDef = _.find(WIKI.data.authentication, ['key', strategy.strategyKey])
        if (!strategyDef) {
          continue
        }
        strategy.config = _.transform(strategyDef.props, (result, value, key) => {
          if (!_.has(result, key)) {
            _.set(result, key, value.default)
            // we have some new properties added to an existing auth strategy to write to the database
            newProps = true
          }
          return result
        }, strategy.config)

        // Fix pre-2.5 strategies displayName
        if (!strategy.displayName) {
          await WIKI.models.authentication.query().patch({
            displayName: strategyDef.title
          }).where('key', strategy.key)
        }
        // write existing auth model to database with new properties and defaults
        if (newProps) {
          await WIKI.models.authentication.query().patch({
            config: strategy.config
          }).where('key', strategy.key)
        }
      }

      WIKI.logger.info(`Loaded ${WIKI.data.authentication.length} authentication strategies: [ OK ]`)
    } catch (err) {
      WIKI.logger.error('Failed to scan or load new authentication providers: [ FAILED ]')
      WIKI.logger.error(err)
    }
  }
}
