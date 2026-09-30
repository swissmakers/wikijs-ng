const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async analytics() { return {} }
  },
  Mutation: {
    async analytics() { return {} }
  },
  AnalyticsQuery: {
    async providers(obj, args, context, info) {
      let providers = await WIKI.models.analytics.getProviders(args.isEnabled)
      providers = providers.map(stg => {
        const providerInfo = _.find(WIKI.data.analytics, ['key', stg.key]) || {}
        return {
          ...providerInfo,
          ...stg,
          config: graphHelper.moduleConfigToKV(stg.config, providerInfo.props, { includeUnknown: true })
        }
      })
      return providers
    }
  },
  AnalyticsMutation: {
    async updateProviders(obj, args, context) {
      try {
        for (let str of args.providers) {
          await WIKI.models.analytics.query().patch({
            isEnabled: str.isEnabled,
            config: graphHelper.kvToModuleConfig(str.config)
          }).where('key', str.key)
          await WIKI.cache.del('analytics')
        }
        return {
          responseResult: graphHelper.generateSuccess('Providers updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
