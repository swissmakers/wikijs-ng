<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-heart-health.svg', alt='Bookmarks', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('profile:bookmarks.title', { defaultValue: 'Bookmarks' }) }}
            .subtitle-1.grey--text.animated.fadeInLeft {{ $t('profile:bookmarks.subtitle', { defaultValue: 'Pages you marked with a star' }) }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
      v-flex(xs12)
        v-card.animated.fadeInUp
          v-list(two-line)
            template(v-for='(bookmark, idx) of bookmarks')
              v-divider(v-if='idx > 0', :key='`div-` + bookmark.id')
              v-list-item(:key='`bookmark-` + bookmark.id', :href='pagePath(bookmark.locale, bookmark.path)')
                v-list-item-avatar
                  v-icon(color='amber darken-2') mdi-star
                v-list-item-content
                  v-list-item-title {{ bookmark.title }}
                  v-list-item-subtitle {{ bookmark.description || `/${bookmark.locale}/${bookmark.path}` }}
                v-list-item-action
                  v-btn(icon, @click.prevent='remove(bookmark)', :aria-label='$t(`common:page.unbookmark`, { defaultValue: `Remove bookmark` })')
                    v-icon mdi-star-off-outline
            v-alert.ma-3(v-if='bookmarks.length < 1', icon='mdi-star-outline', outlined, color='grey')
              em.caption {{ $t('profile:bookmarks.empty', { defaultValue: 'No bookmarks yet. Use the star on a page to bookmark it.' }) }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { pagePath } from '@/helpers'

export default {
  data () {
    return {
      bookmarks: []
    }
  },
  methods: {
    pagePath,
    async refresh () {
      await this.$apollo.queries.bookmarks.refetch()
    },
    async remove (bookmark) {
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($pageId: Int!) {
              bookmarks { toggle(pageId: $pageId) { responseResult { succeeded message } isBookmarked } }
            }
          `,
          variables: { pageId: bookmark.pageId }
        })
        if (!_.get(resp, 'data.bookmarks.toggle.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.bookmarks.toggle.responseResult.message', this.$t('common:error.unexpected')))
        }
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    bookmarks: {
      query: gql`
        {
          bookmarks {
            list { id pageId locale path title description createdAt }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.get(data, 'bookmarks.list', []),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'profile-bookmarks-refresh')
      }
    }
  }
}
</script>
