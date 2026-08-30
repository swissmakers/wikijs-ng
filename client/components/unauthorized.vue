<template lang='pug'>
  v-app
    .system-page
      .system-page-card.animated.fadeIn
        v-icon(size='96', color='error') mdi-shield-lock-outline
        .system-page-title {{$t('unauthorized.title')}}
        .system-page-subtitle {{$t('unauthorized.action.' + action)}}
        .system-page-actions
          v-btn(href='/login', color='primary', depressed, x-large)
            v-icon(left) mdi-login
            span {{$t('unauthorized.login')}}
          v-btn(color='primary', text, href='javascript:window.history.go(-1);')
            v-icon(left) mdi-arrow-left
            span {{$t('unauthorized.goback')}}
</template>

<script>

export default {
  props: {
    action: {
      type: String,
      default: 'view'
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
