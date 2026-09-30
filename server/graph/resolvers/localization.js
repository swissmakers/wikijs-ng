const graphHelper = require('../../helpers/graph')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  Query: {
    async localization() { return {} }
  },
  Mutation: {
    async localization() { return {} }
  },
  LocalizationQuery: {
    async locales(obj, args, context, info) {
      const dbLocales = await WIKI.models.locales.query().select('code', 'isRTL', 'name', 'nativeName', 'strings')
      return _.sortBy(_.compact(_.map(dbLocales, lc => {
        const isBundled = WIKI.lang.isBundled(lc.code)
        const isSideloaded = _.some(WIKI.lang.sideloaded, ['code', lc.code])
        // -> Only list locales that actually have strings available
        if (!isBundled && !isSideloaded && (!_.isPlainObject(lc.strings) || _.isEmpty(lc.strings))) {
          return null
        }
        return {
          code: lc.code,
          name: lc.name,
          nativeName: lc.nativeName,
          isRTL: Boolean(lc.isRTL),
          isBundled,
          isSideloaded
        }
      })), 'name')
    },
    async config(obj, args, context, info) {
      return {
        locale: WIKI.config.lang.code,
        namespacing: WIKI.config.lang.namespacing,
        namespaces: WIKI.config.lang.namespaces,
        sideloadPath: WIKI.lang.getSideloadPath()
      }
    },
    translations (obj, args, context, info) {
      return WIKI.lang.getByNamespace(args.locale, args.namespace)
    }
  },
  LocalizationMutation: {
    async updateLocale(obj, args, context) {
      try {
        const newLocale = await WIKI.models.locales.query().select('isRTL').where('code', args.locale).first()
        if (!newLocale) {
          throw new WIKI.Error.InputInvalid()
        }

        WIKI.config.lang.code = args.locale
        WIKI.config.lang.namespacing = args.namespacing
        WIKI.config.lang.namespaces = _.union(args.namespaces, [args.locale])
        WIKI.config.lang.rtl = Boolean(newLocale.isRTL)

        await WIKI.configSvc.saveToDb(['lang'])

        await WIKI.lang.setCurrentLocale(args.locale)
        await WIKI.lang.refreshNamespaces()

        await WIKI.cache.del('nav:locales')

        return {
          responseResult: graphHelper.generateSuccess('Locale config updated')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
