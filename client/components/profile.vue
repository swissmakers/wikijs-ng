<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').profile
    nav-header
    v-navigation-drawer.pb-0(v-model='profileDrawerShown', app, fixed, clipped, left, permanent)
      v-list(dense, nav)
        v-list-item(to='/profile', color='primary')
          v-list-item-action: v-icon mdi-face-profile
          v-list-item-content
            v-list-item-title {{$t('profile:title')}}
        v-list-item(to='/pages', color='primary')
          v-list-item-action: v-icon mdi-file-document-outline
          v-list-item-content
            v-list-item-title {{$t('profile:pages.title')}}

    v-main(:class='$vuetify.theme.dark ? "grey darken-4" : "grey lighten-5"')
      .profile-content-container
        transition(name='profile-router')
          router-view

    nav-footer
    notify
    search-results
</template>

<script>
import VueRouter from 'vue-router'

/* global WIKI */

const router = new VueRouter({
  mode: 'history',
  base: '/p',
  routes: [
    { path: '/', redirect: '/profile' },
    { path: '/profile', component: () => import(/* webpackChunkName: "profile" */ './profile/profile.vue') },
    { path: '/pages', component: () => import(/* webpackChunkName: "profile" */ './profile/pages.vue') }
  ]
})

router.beforeEach((to, from, next) => {
  WIKI.$store.commit('loadingStart', 'profile')
  next()
})

router.afterEach((to, from) => {
  WIKI.$store.commit('loadingStop', 'profile')
})

export default {
  i18nOptions: { namespaces: 'profile' },
  data() {
    return {
      profileDrawerShown: true
    }
  },
  router,
  created() {
    this.$store.commit('page/SET_MODE', 'profile')
  }
}
</script>

<style lang='scss'>

.profile-router {
  &-enter-active, &-leave-active {
    transition: opacity .25s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .25s;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }
}

.profile-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding-bottom: 4px;

  > img {
    width: 64px !important;
    height: 64px;
    padding: 10px;
    background-color: rgba(mc('theme', 'primary'), .08);
    border-radius: 12px;

    @at-root .theme--dark & {
      background-color: rgba(mc('theme', 'accent'), .15);
    }
  }

  &-title {
    margin-left: 1rem;

    .headline {
      font-weight: 500;
      letter-spacing: -.25px;
    }
  }
}

.profile-content-container {
  max-width: 1400px;
}

</style>
