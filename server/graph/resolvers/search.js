const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async search() { return {} }
  },
  Mutation: {
    async search() { return {} }
  },
  SearchQuery: {
    async searchEngines(obj, args, context, info) {
      let searchEngines = await WIKI.models.searchEngines.getSearchEngines()
      // -> Skip engines that have no definition on disk (stale rows would fail the whole query)
      searchEngines = searchEngines.filter(searchEngine => _.some(WIKI.data.searchEngines, ['key', searchEngine.key]))
      searchEngines = searchEngines.map(searchEngine => {
        const searchEngineInfo = _.find(WIKI.data.searchEngines, ['key', searchEngine.key]) || {}
        return {
          ...searchEngineInfo,
          ...searchEngine,
          config: graphHelper.moduleConfigToKV(searchEngine.config, searchEngineInfo.props)
        }
      })
      // if (args.filter) { searchEngines = graphHelper.filter(searchEngines, args.filter) }
      if (args.orderBy) { searchEngines = _.sortBy(searchEngines, [args.orderBy]) }
      return searchEngines
    }
  },
  SearchMutation: {
    async updateSearchEngines(obj, args, context) {
      try {
        let newActiveEngine = ''
        for (let searchEngine of args.engines) {
          if (searchEngine.isEnabled) {
            newActiveEngine = searchEngine.key
          }
          await WIKI.models.searchEngines.query().patch({
            isEnabled: searchEngine.isEnabled,
            config: graphHelper.kvToModuleConfig(searchEngine.config)
          }).where('key', searchEngine.key)
        }
        if (newActiveEngine !== WIKI.data.searchEngine.key) {
          try {
            await WIKI.data.searchEngine.deactivate()
          } catch (err) {
            WIKI.logger.warn('Failed to deactivate previous search engine:', err)
          }
        }
        await WIKI.models.searchEngines.initEngine({ activate: true })
        return {
          responseResult: graphHelper.generateSuccess('Search Engines updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async rebuildIndex (obj, args, context) {
      try {
        await WIKI.data.searchEngine.rebuild()
        return {
          responseResult: graphHelper.generateSuccess('Index rebuilt successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
