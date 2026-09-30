import i18next from 'i18next'
import Backend from 'i18next-chained-backend'
import LocalStorageBackend from 'i18next-localstorage-backend'
import VueI18Next from '@panter/vue-i18next'
import _ from 'lodash'

/* global siteConfig, graphQL */

import localeQuery from 'gql/common/common-localization-query-translations.gql'

/**
 * Loads a namespace through the GraphQL translations query
 */
const GraphQLBackend = {
  type: 'backend',
  init () {},
  read (language, namespace, callback) {
    graphQL.query({
      query: localeQuery,
      variables: {
        locale: language,
        namespace
      }
    }).then(resp => {
      const ns = {}
      _.get(resp, 'data.localization.translations', []).forEach(entry => {
        _.set(ns, entry.key, entry.value)
      })
      callback(null, ns)
    }).catch(err => {
      console.error(err)
      callback(err, null)
    })
  }
}

export default {
  VueI18Next,
  init() {
    i18next
      .use(Backend)
      .init({
        backend: {
          backends: [
            LocalStorageBackend,
            GraphQLBackend
          ],
          backendOptions: [
            {
              expirationTime: 1000 * 60 * 60 * 24, // 24h
              defaultVersion: siteConfig.localeVersion || 'v1'
            },
            {}
          ]
        },
        defaultNS: 'common',
        lng: siteConfig.lang,
        load: 'currentOnly',
        lowerCaseLng: true,
        fallbackLng: 'en',
        ns: ['common', 'auth']
      })
    return new VueI18Next(i18next)
  }
}
