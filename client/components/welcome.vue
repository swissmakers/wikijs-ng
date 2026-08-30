<template lang='pug'>
  v-app
    .system-page
      .system-page-card.animated.fadeIn
        img.system-page-logo(src='/_assets/svg/logo-wikijs.svg', alt='Wiki.js NG')
        .system-page-title {{ $t('welcome.title') }}
        .system-page-subtitle {{ $t('welcome.subtitle') }}
        .system-page-actions
          v-btn(color='primary', :href='`/e/` + locale + `/home`', depressed, x-large)
            v-icon(left) mdi-plus
            span {{ $t('welcome.createhome') }}
          v-btn(color='primary', href='/a', outlined, x-large)
            v-icon(left) mdi-view-dashboard
            span {{ $t('welcome.goadmin') }}
</template>

<script>

export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
