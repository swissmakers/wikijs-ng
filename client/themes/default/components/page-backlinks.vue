<template lang="pug">
  .page-backlinks(v-intersect.once='onIntersect')
    template(v-if='backlinks.length > 0')
      .overline.grey--text.mb-2
        v-icon.mr-1(small, color='grey') mdi-link-variant
        span {{ title }}
      .page-backlinks-list
        v-tooltip(bottom, v-for='page of backlinks', :key='page.id', :disabled='!page.description')
          template(v-slot:activator='{ on }')
            v-chip.mr-2.mb-2(
              v-on='on'
              small
              outlined
              color='primary'
              :href='pagePath(page.locale, page.path)'
              )
              v-icon(left, x-small) mdi-file-document-outline
              span {{ page.title || page.path }}
          span {{ page.description }}
</template>

<script>
import _ from 'lodash'

import { pagePath } from '@/helpers'
import backlinksQuery from 'gql/common/common-pages-query-backlinks.gql'

export default {
  props: {
    locale: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    }
  },
  data () {
    return {
      backlinks: []
    }
  },
  computed: {
    title () {
      return this.$t('common:page.backlinks', { defaultValue: 'Pages linking here' }) + ` (${this.backlinks.length})`
    }
  },
  methods: {
    pagePath,
    async onIntersect (entries, observer, isIntersecting) {
      if (!isIntersecting) {
        return
      }
      try {
        const resp = await this.$apollo.query({
          query: backlinksQuery,
          fetchPolicy: 'network-only',
          variables: {
            path: this.path,
            locale: this.locale
          }
        })
        this.backlinks = _.get(resp, 'data.pages.backlinks', [])
      } catch (err) {
        console.warn(err)
      }
    }
  }
}
</script>

<style lang="scss">
.page-backlinks {
  min-height: 1px;
}
</style>
