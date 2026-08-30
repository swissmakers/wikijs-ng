<template lang='pug'>
  v-app
    .system-page
      .system-page-card.animated.fadeIn
        v-icon(size='96', color='primary') mdi-file-plus-outline
        .system-page-title {{ $t('newpage.title') }}
        .system-page-subtitle {{ $t('newpage.subtitle') }}
        .system-page-actions
          v-btn(:href='`/e/` + locale + `/` + path', color='primary', depressed, x-large)
            v-icon(left) mdi-plus
            span {{ $t('newpage.create') }}
          v-btn(color='primary', text, href='javascript:window.history.go(-1);')
            v-icon(left) mdi-arrow-left
            span {{ $t('newpage.goback') }}
</template>

<script>

export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
