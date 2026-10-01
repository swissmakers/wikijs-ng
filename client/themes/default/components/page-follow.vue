<template lang="pug">
  .page-follow.d-inline-flex(v-if='isAuthenticated')
    v-tooltip(bottom)
      template(v-slot:activator='{ on }')
        v-btn(icon, tile, v-on='on', @click='toggleBookmark', :loading='isBusy', :aria-label='bookmarkLabel')
          v-icon(:color='isBookmarked ? `amber darken-2` : `grey`') {{ isBookmarked ? 'mdi-star' : 'mdi-star-outline' }}
      span {{ bookmarkLabel }}
    v-menu(v-if='notificationsEnabled', offset-y, bottom, min-width='300')
      template(v-slot:activator='{ on: menu }')
        v-tooltip(bottom)
          template(v-slot:activator='{ on: tooltip }')
            v-btn(icon, tile, v-on='{ ...menu, ...tooltip }', :aria-label='watchLabel')
              v-icon(:color='isWatched ? `primary` : `grey`') {{ isWatched ? 'mdi-bell-ring' : 'mdi-bell-outline' }}
          span {{ watchLabel }}
      v-list(dense, nav)
        v-list-item(@click='watchPage', :disabled='status.pageWatchId > 0')
          v-list-item-icon: v-icon(small, :color='status.pageWatchId > 0 ? `primary` : ``') {{ status.pageWatchId > 0 ? 'mdi-check' : 'mdi-file-document-outline' }}
          v-list-item-title {{ $t('common:page.watchPage', { defaultValue: 'Watch this page' }) }}
        v-list-item(@click='watchPath', :disabled='status.pathWatchId > 0')
          v-list-item-icon: v-icon(small, :color='status.pathWatchId > 0 ? `primary` : ``') {{ status.pathWatchId > 0 ? 'mdi-check' : 'mdi-file-tree-outline' }}
          v-list-item-title {{ $t('common:page.watchSubtree', { defaultValue: 'Watch this page and its subpages' }) }}
        v-list-item(v-if='status.pageWatchId > 0 || status.pathWatchId > 0', @click='stopWatching')
          v-list-item-icon: v-icon(small, color='red darken-2') mdi-bell-off-outline
          v-list-item-title {{ $t('common:page.stopWatching', { defaultValue: 'Stop watching' }) }}
        .caption.grey--text.px-4.py-2(v-if='coveringLabel') {{ coveringLabel }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

/* global siteConfig */

const RESULT_FIELDS = 'responseResult { succeeded errorCode slug message }'

export default {
  props: {
    pageId: {
      type: Number,
      required: true
    },
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
      isBusy: false,
      isBookmarked: false,
      status: {
        pageWatchId: 0,
        pathWatchId: 0,
        coveringPath: null
      }
    }
  },
  computed: {
    isAuthenticated: get('user/authenticated'),
    notificationsEnabled () {
      return siteConfig.notifications === true
    },
    isWatched () {
      return this.status.pageWatchId > 0 || this.status.pathWatchId > 0 || Boolean(this.status.coveringPath)
    },
    bookmarkLabel () {
      return this.isBookmarked ? this.$t('common:page.unbookmark', { defaultValue: 'Remove bookmark' }) : this.$t('common:page.bookmark')
    },
    watchLabel () {
      return this.$t('common:page.watch', { defaultValue: 'Watch' })
    },
    coveringLabel () {
      return this.status.coveringPath ? this.$t('common:page.watchCovered', { path: this.status.coveringPath, defaultValue: 'Already notified through your watch on {{path}}.', interpolation: { escapeValue: false } }) : ''
    }
  },
  mounted () {
    if (this.isAuthenticated) {
      this.refresh()
      this.$root.$on('pageToggleBookmark', this.toggleBookmark)
      this.$root.$on('pageWatch', this.onWatchShortcut)
    }
  },
  beforeDestroy () {
    this.$root.$off('pageToggleBookmark', this.toggleBookmark)
    this.$root.$off('pageWatch', this.onWatchShortcut)
  },
  methods: {
    async refresh () {
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($pageId: Int!, $withWatches: Boolean!) {
              bookmarks { isBookmarked(pageId: $pageId) }
              watches @include(if: $withWatches) {
                status(pageId: $pageId) { pageWatchId pathWatchId coveringPath }
              }
            }
          `,
          fetchPolicy: 'network-only',
          variables: { pageId: this.pageId, withWatches: this.notificationsEnabled }
        })
        this.isBookmarked = _.get(resp, 'data.bookmarks.isBookmarked', false)
        this.status = _.get(resp, 'data.watches.status', this.status) || this.status
      } catch (err) {
        console.warn(err)
      }
    },
    async mutate (mutation, variables, path) {
      this.isBusy = true
      let result = null
      try {
        const resp = await this.$apollo.mutate({ mutation, variables })
        result = _.get(resp, path, {})
        if (!_.get(result, 'responseResult.succeeded', false)) {
          throw new Error(_.get(result, 'responseResult.message', this.$t('common:error.unexpected')))
        }
        this.$store.commit('showNotification', { style: 'success', message: result.responseResult.message, icon: 'check' })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        result = null
      }
      this.isBusy = false
      return result
    },
    async toggleBookmark () {
      const result = await this.mutate(gql`mutation ($pageId: Int!) { bookmarks { toggle(pageId: $pageId) { ${RESULT_FIELDS} isBookmarked } } }`, { pageId: this.pageId }, 'data.bookmarks.toggle')
      if (result) {
        this.isBookmarked = result.isBookmarked
      }
    },
    onWatchShortcut () {
      if (this.notificationsEnabled && this.status.pageWatchId < 1) {
        this.watchPage()
      }
    },
    async watchPage () {
      if (await this.mutate(gql`mutation ($pageId: Int!) { watches { watchPage(pageId: $pageId) { ${RESULT_FIELDS} } } }`, { pageId: this.pageId }, 'data.watches.watchPage')) {
        this.refresh()
      }
    },
    async watchPath () {
      if (await this.mutate(gql`mutation ($locale: String!, $path: String!) { watches { watchPath(locale: $locale, path: $path) { ${RESULT_FIELDS} } } }`, { locale: this.locale, path: this.path }, 'data.watches.watchPath')) {
        this.refresh()
      }
    },
    async stopWatching () {
      for (const id of _.compact([this.status.pageWatchId, this.status.pathWatchId])) {
        await this.mutate(gql`mutation ($id: Int!) { watches { remove(id: $id) { ${RESULT_FIELDS} } } }`, { id }, 'data.watches.remove')
      }
      this.refresh()
    }
  }
}
</script>
