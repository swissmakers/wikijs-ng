<template lang='pug'>
  v-app
    .system-page
      .system-page-card.animated.fadeIn
        v-icon(size='96', color='error') mdi-text-box-remove-outline
        .system-page-title {{$t('notfound.title')}}
        .system-page-subtitle {{$t('notfound.subtitle')}}
        .system-page-hint {{$t('notfound.searchHint', { defaultValue: 'Tip: use the search bar on the home page to find what you were looking for.' })}}
        .system-page-actions
          v-btn(color='primary', href='/', depressed, x-large)
            v-icon(left) mdi-home
            span {{$t('notfound.gohome')}}
          v-btn(color='primary', text, href='javascript:window.history.go(-1);')
            v-icon(left) mdi-arrow-left
            span {{$t('common:actions.goBack', { defaultValue: 'Go Back' })}}
</template>

<script>

export default {
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
