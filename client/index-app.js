require('core-js/stable')
require('regenerator-runtime/runtime')

/* global siteConfig */
require('./scss/app.scss')
import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/scss/app.scss')

import(/* webpackChunkName: "mdi" */ '@mdi/font/css/materialdesignicons.css')

require('./client-app.js')
