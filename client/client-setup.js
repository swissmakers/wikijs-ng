/* eslint-disable import/first */
import Vue from 'vue'
import Vuetify from 'vuetify/lib'
import boot from './modules/boot'
import { serverRenderedRoot, isRegisteredComponent } from './helpers/mount'
/* eslint-enable import/first */

window.WIKI = null
window.boot = boot

Vue.use(Vuetify)

Vue.component('Setup', () => import(/* webpackMode: "eager" */ './components/setup.vue'))

const bootstrap = () => {
  const rootEl = document.getElementById('root')
  window.WIKI = new Vue({
    el: rootEl,
    render: serverRenderedRoot(rootEl, { isComponent: isRegisteredComponent(Vue) }),
    vuetify: new Vuetify({
      theme: {
        themes: {
          light: {
            primary: '#2A5BD6',
            secondary: '#00204B',
            accent: '#5B85E8',
            anchor: '#2A5BD6',
            info: '#2A5BD6'
          }
        }
      }
    })
  })
}

window.boot.onDOMReady(bootstrap)
