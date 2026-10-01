const Model = require('objection').Model
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * SearchEngine model
 */
module.exports = class SearchEngine extends Model {
  static get tableName () { return 'searchEngines' }
  static get idColumn () { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: { type: 'string' },
        isEnabled: { type: 'boolean' },
        level: { type: 'string' }
      }
    }
  }

  static get jsonAttributes () {
    return ['config']
  }

  static async getSearchEngines () {
    return WIKI.models.searchEngines.query()
  }

  static async refreshSearchEnginesFromDisk () {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'search',
      dataKey: 'searchEngines',
      model: 'searchEngines',
      label: 'search engines'
    })
  }

  static async initEngine ({ activate = false } = {}) {
    let searchEngine = await WIKI.models.searchEngines.query().findOne('isEnabled', true)
    if (!searchEngine) {
      // -> No engine is enabled (e.g. the active module was removed from disk): revert to basic engine
      WIKI.logger.warn('No search engine is enabled. Reverting to the basic database engine...')
      await WIKI.models.searchEngines.query().patch({ isEnabled: true }).where('key', 'db')
      searchEngine = await WIKI.models.searchEngines.query().findOne('isEnabled', true)
    }
    if (searchEngine) {
      WIKI.data.searchEngine = require(`../modules/search/${searchEngine.key}/engine`)
      WIKI.data.searchEngine.key = searchEngine.key
      WIKI.data.searchEngine.config = searchEngine.config
      if (activate) {
        try {
          await WIKI.data.searchEngine.activate()
        } catch (err) {
          // -> Revert to basic engine
          if (err instanceof WIKI.Error.SearchActivationFailed) {
            await WIKI.models.searchEngines.query().patch({ isEnabled: false }).where('key', searchEngine.key)
            await WIKI.models.searchEngines.query().patch({ isEnabled: true }).where('key', 'db')
            await WIKI.models.searchEngines.initEngine()
          }
          throw err
        }
      }

      try {
        await WIKI.data.searchEngine.init()
      } catch (err) {
        WIKI.logger.warn(err)
      }
    }
  }
}
