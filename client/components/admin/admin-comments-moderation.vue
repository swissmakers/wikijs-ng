<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-chat-bubble.svg', alt='Comments', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:comments.moderation', { defaultValue: 'Comment Moderation' }) }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{ $t('admin:comments.moderationSubtitle', { defaultValue: 'Review comments held for approval' }) }}
          v-spacer
          v-btn.mr-3.animated.fadeInDown.wait-p2s(icon, outlined, color='grey', to='/comments')
            v-icon mdi-arrow-left
          v-btn.animated.fadeInDown.wait-p2s(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
      v-flex(xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, :color='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-4`', dense)
            v-switch(
              v-model='pendingOnly'
              inset
              hide-details
              color='primary'
              :label='$t(`admin:comments.pendingOnly`, { defaultValue: "Pending only" })'
              )
          v-divider
          v-list(three-line)
            template(v-for='(cm, idx) of comments')
              v-divider(v-if='idx > 0', :key='`div-` + cm.id')
              v-list-item(:key='`cm-` + cm.id')
                v-list-item-content
                  v-list-item-title
                    a(:href='pagePath(cm.pageLocale, cm.pagePath) + `#comment-post-id-` + cm.id', target='_blank') {{ cm.pageTitle }}
                    v-chip.ml-2(v-if='!cm.isApproved', x-small, label, color='orange', dark) {{ $t('common:comments.pending', { defaultValue: 'Awaiting approval' }) }}
                  v-list-item-subtitle {{ cm.authorName }} · {{ cm.createdAt | date('calendar') }}
                  .body-2.mt-1.admin-comments-moderation-content(v-html='cm.render')
                v-list-item-action.flex-row.align-center
                  v-btn.mr-2(v-if='!cm.isApproved', small, depressed, color='success', @click='approve(cm)')
                    v-icon(left, small) mdi-check
                    span {{ $t('common:comments.approve', { defaultValue: 'Approve' }) }}
                  v-btn(small, outlined, color='red darken-2', @click='remove(cm)')
                    v-icon(left, small) mdi-delete
                    span {{ $t('common:actions.delete') }}
            v-alert.ma-3(v-if='comments.length < 1', icon='mdi-check-all', outlined, color='grey')
              em.caption {{ $t('admin:comments.moderationEmpty', { defaultValue: 'No comments to review.' }) }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { pagePath } from '@/helpers'

export default {
  data () {
    return {
      comments: [],
      pendingOnly: true
    }
  },
  methods: {
    pagePath,
    async refresh () {
      await this.$apollo.queries.comments.refetch()
    },
    async run (mutation, id, path) {
      try {
        const resp = await this.$apollo.mutate({ mutation, variables: { id } })
        const result = _.get(resp, path, {})
        if (!result.succeeded) {
          throw new Error(result.message)
        }
        this.$store.commit('showNotification', { style: 'success', message: result.message, icon: 'check' })
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    approve (cm) {
      return this.run(gql`mutation ($id: Int!) { comments { approve(id: $id) { responseResult { succeeded errorCode slug message } } } }`, cm.id, 'data.comments.approve.responseResult')
    },
    remove (cm) {
      return this.run(gql`mutation ($id: Int!) { comments { delete(id: $id) { responseResult { succeeded errorCode slug message } } } }`, cm.id, 'data.comments.delete.responseResult')
    }
  },
  apollo: {
    comments: {
      query: gql`
        query ($pendingOnly: Boolean) {
          comments {
            moderation(pendingOnly: $pendingOnly, limit: 100) {
              id replyTo render authorName isApproved createdAt pageId pageLocale pagePath pageTitle
            }
          }
        }
      `,
      variables () {
        return { pendingOnly: this.pendingOnly }
      },
      fetchPolicy: 'network-only',
      update: (data) => _.get(data, 'comments.moderation', []),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-comments-moderation')
      }
    }
  }
}
</script>

<style lang='scss'>
.admin-comments-moderation-content {
  white-space: normal;

  p {
    margin-bottom: 0;
  }
}
</style>
