/* eslint-disable import/first */
import Vue from 'vue'
import Vuetify from 'vuetify/lib'
import boot from './modules/boot'
/* eslint-enable import/first */

window.WIKI = null
window.boot = boot

Vue.use(Vuetify)

Vue.component('setup', () => import(/* webpackMode: "eager" */ './components/setup.vue'))

let bootstrap = () => {
  window.WIKI = new Vue({
    el: '#root',
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
