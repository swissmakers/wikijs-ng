/* global siteConfig */

import Vue from 'vue'
import VueRouter from 'vue-router'
import { ApolloClient, ApolloLink, InMemoryCache } from '@apollo/client/core'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { onError } from '@apollo/client/link/error'
import VueApollo from 'vue-apollo'
import Vuetify from 'vuetify/lib'
import Velocity from 'velocity-animate'
import Vuescroll from 'vuescroll/dist/vuescroll-native'
import store from './store'
import Cookies from 'js-cookie'

// ====================================
// Load Modules
// ====================================

import boot from './modules/boot'
import localization from './modules/localization'
import datetime from './modules/datetime'

// ====================================
// Load Helpers
// ====================================

import { initials, bytes } from './helpers'
import { initAppearance, getGuestAppearance } from './helpers/appearance'

// ====================================
// Initialize Global Vars
// ====================================

window.WIKI = null
window.boot = boot

store.commit('user/REFRESH_AUTH')

// ====================================
// Initialize Apollo Client (GraphQL)
// ====================================

const graphQLEndpoint = window.location.protocol + '//' + window.location.host + '/graphql'

const graphQLLink = ApolloLink.from([
  onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      let isAuthError = false
      graphQLErrors.forEach(({ message, locations, path }) => {
        if (message === 'Forbidden') {
          isAuthError = true
        }
        console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
      })
      store.commit('showNotification', {
        style: 'red',
        message: isAuthError ? 'You are not authorized to access this resource.' : 'An unexpected error occurred.',
        icon: 'alert'
      })
    }
    if (networkError) {
      console.error(networkError)
      store.commit('showNotification', {
        style: 'red',
        message: `Network Error: ${networkError.message}`,
        icon: 'alert'
      })
    }
  }),
  new BatchHttpLink({
    includeExtensions: true,
    uri: graphQLEndpoint,
    credentials: 'include',
    fetch: async (uri, options) => {
      // Strip __typename fields from variables
      let body = JSON.parse(options.body)
      body = body.map(bd => {
        return ({
          ...bd,
          variables: JSON.parse(JSON.stringify(bd.variables), (key, value) => { return key === '__typename' ? undefined : value })
        })
      })
      options.body = JSON.stringify(body)

      // Inject authentication token
      const jwtToken = Cookies.get('jwt')
      if (jwtToken) {
        options.headers.Authorization = `Bearer ${jwtToken}`
      }

      const resp = await fetch(uri, options)

      // Handle renewed JWT
      const newJWT = resp.headers.get('new-jwt')
      if (newJWT) {
        Cookies.set('jwt', newJWT, { expires: 365, secure: window.location.protocol === 'https:' })
      }
      return resp
    }
  })
])

window.graphQL = new ApolloClient({
  link: graphQLLink,
  cache: new InMemoryCache(),
  connectToDevTools: (process.env.NODE_ENV === 'development')
})

// ====================================
// Initialize Vue Modules
// ====================================

Vue.config.productionTip = false

datetime.setLocale(siteConfig.lang)

Vue.use(VueRouter)
Vue.use(VueApollo)
Vue.use(localization.VueI18Next)
Vue.use(Vuetify)
Vue.use(Vuescroll)

Vue.prototype.Velocity = Velocity

Vue.filter('initials', initials)
Vue.filter('date', datetime.formatDate)
Vue.prototype.$datetime = datetime
Vue.filter('bytes', bytes)

// ====================================
// Register Vue Components
// ====================================

Vue.component('Admin', () => import(/* webpackChunkName: "admin" */ './components/admin.vue'))
Vue.component('Comments', () => import(/* webpackChunkName: "comments" */ './components/comments.vue'))
Vue.component('Editor', () => import(/* webpackPrefetch: -100, webpackChunkName: "editor" */ './components/editor.vue'))
Vue.component('FolderView', () => import(/* webpackChunkName: "folder-view" */ './components/folder-view.vue'))
Vue.component('History', () => import(/* webpackChunkName: "history" */ './components/history.vue'))
Vue.component('Loader', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/loader.vue'))
Vue.component('Login', () => import(/* webpackPrefetch: true, webpackChunkName: "login" */ './components/login.vue'))
Vue.component('NavHeader', () => import(/* webpackMode: "eager" */ './components/common/nav-header.vue'))
Vue.component('NewPage', () => import(/* webpackChunkName: "new-page" */ './components/new-page.vue'))
Vue.component('Notify', () => import(/* webpackMode: "eager" */ './components/common/notify.vue'))
Vue.component('NotFound', () => import(/* webpackChunkName: "not-found" */ './components/not-found.vue'))
Vue.component('PageSelector', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/page-selector.vue'))
Vue.component('PageSource', () => import(/* webpackChunkName: "source" */ './components/source.vue'))
Vue.component('RecentChanges', () => import(/* webpackChunkName: "recent" */ './components/recent-changes.vue'))
Vue.component('Profile', () => import(/* webpackChunkName: "profile" */ './components/profile.vue'))
Vue.component('Register', () => import(/* webpackChunkName: "register" */ './components/register.vue'))
Vue.component('SearchResults', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/search-results.vue'))
Vue.component('SocialSharing', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/social-sharing.vue'))
Vue.component('Tags', () => import(/* webpackChunkName: "tags" */ './components/tags.vue'))
Vue.component('Unauthorized', () => import(/* webpackChunkName: "unauthorized" */ './components/unauthorized.vue'))
Vue.component('VCardChin', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-chin.vue'))
Vue.component('VCardInfo', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-info.vue'))
Vue.component('Welcome', () => import(/* webpackChunkName: "welcome" */ './components/welcome.vue'))

Vue.component('NavFooter', () => import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/components/nav-footer.vue'))
Vue.component('Page', () => import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/components/page.vue'))

const bootstrap = () => {
  // ====================================
  // Notifications
  // ====================================

  window.addEventListener('beforeunload', () => {
    store.dispatch('startLoading')
  })

  const apolloProvider = new VueApollo({
    defaultClient: window.graphQL
  })

  // ====================================
  // Bootstrap Vue
  // ====================================

  const i18n = localization.init()

  const darkModeEnabled = initAppearance(store.get('user/authenticated') ? store.get('user/appearance') : getGuestAppearance())

  window.WIKI = new Vue({
    el: '#root',
    components: {},
    apolloProvider,
    store,
    i18n,
    vuetify: new Vuetify({
      rtl: siteConfig.rtl,
      theme: {
        dark: darkModeEnabled,
        themes: {
          light: {
            primary: '#2A5BD6',
            secondary: '#00204B',
            accent: '#5B85E8',
            header: '#00204B',
            anchor: '#2A5BD6',
            info: '#2A5BD6',
            success: '#4CAF50',
            warning: '#FB8C00',
            error: '#FF5252'
          },
          dark: {
            primary: '#0f3c78',
            secondary: '#8FA8CC',
            accent: '#5B85E8',
            header: '#0b1522',
            anchor: '#659DE7',
            info: '#659DE7',
            success: '#4CAF50',
            warning: '#FB8C00',
            error: '#FF5252'
          }
        }
      }
    }),
    mounted () {
      datetime.setDateFormat(store.get('user/dateFormat'))
      datetime.setZone(store.get('user/timezone'))
    }
  })

  // ----------------------------------
  // Dispatch boot ready
  // ----------------------------------

  window.boot.notify('vue')
}

window.boot.onDOMReady(bootstrap)
