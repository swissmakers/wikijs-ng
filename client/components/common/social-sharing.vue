<template lang="pug">
  v-list(nav, dense)
    v-list-item(@click='', ref='copyUrlButton')
      v-icon(color='grey', small) mdi-content-copy
      v-list-item-title.px-3 {{ $t('common:page.copyLink', { defaultValue: 'Copy link' }) }}
    v-list-item(:href='`mailto:?subject=` + encodeURIComponent(title) + `&body=` + encodeURIComponent(url) + `%0D%0A%0D%0A` + encodeURIComponent(description)')
      v-icon(color='grey', small) mdi-email-outline
      v-list-item-title.px-3 {{ $t('common:page.shareByEmail', { defaultValue: 'Send by email' }) }}
</template>

<script>
import ClipboardJS from 'clipboard'

export default {
  props: {
    url: {
      type: String,
      default: window.location.href
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    }
  },
  mounted () {
    // -> ClipboardJS also works on plain HTTP, unlike navigator.clipboard
    const clip = new ClipboardJS(this.$refs.copyUrlButton.$el, {
      text: () => { return this.url }
    })

    clip.on('success', () => {
      this.$store.commit('showNotification', {
        style: 'success',
        message: this.$t('common:page.linkCopied', { defaultValue: 'Link copied to clipboard.' }),
        icon: 'content-copy'
      })
    })
    clip.on('error', () => {
      this.$store.commit('showNotification', {
        style: 'red',
        message: this.$t('common:page.linkCopyFailed', { defaultValue: 'Failed to copy to clipboard.' }),
        icon: 'alert'
      })
    })
  }
}
</script>
