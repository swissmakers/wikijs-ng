<template lang="pug">
  div(v-intersect.once='onIntersect')
    v-textarea#discussion-new(
      outlined
      flat
      :placeholder='$t(`common:comments.newPlaceholder`)'
      auto-grow
      dense
      rows='3'
      hide-details
      v-model='newcomment'
      color='blue-grey darken-2'
      :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
      v-if='permissions.write'
      :aria-label='$t(`common:comments.fieldContent`)'
    )
    v-row.mt-2(dense, v-if='!isAuthenticated && permissions.write')
      v-col(cols='12', lg='6')
        v-text-field(
          outlined
          color='blue-grey darken-2'
          :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
          :placeholder='$t(`common:comments.fieldName`)'
          hide-details
          dense
          autocomplete='name'
          v-model='guestName'
          :aria-label='$t(`common:comments.fieldName`)'
        )
      v-col(cols='12', lg='6')
        v-text-field(
          outlined
          color='blue-grey darken-2'
          :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
          :placeholder='$t(`common:comments.fieldEmail`)'
          hide-details
          type='email'
          dense
          autocomplete='email'
          v-model='guestEmail'
          :aria-label='$t(`common:comments.fieldEmail`)'
        )
    .d-flex.align-center.pt-3(v-if='permissions.write')
      v-icon.mr-1(color='blue-grey') mdi-language-markdown-outline
      .caption.blue-grey--text {{$t('common:comments.markdownFormat')}}
      v-spacer
      .caption.mr-3(v-if='isAuthenticated')
        i18next(tag='span', path='common:comments.postingAs')
          strong(place='name') {{userDisplayName}}
      v-btn(
        dark
        color='blue-grey darken-2'
        @click='postComment'
        depressed
        :aria-label='$t(`common:comments.postComment`)'
        )
        v-icon(left) mdi-comment
        span.text-none {{$t('common:comments.postComment')}}
    v-divider.mt-3(v-if='permissions.write')
    .pa-5.d-flex.align-center.justify-center(v-if='isLoading && !hasLoadedOnce')
      v-progress-circular(
        indeterminate
        size='20'
        width='1'
        color='blue-grey'
      )
      .caption.blue-grey--text.pl-3: em {{$t('common:comments.loading')}}
    v-timeline(
      dense
      v-else-if='comments && comments.length > 0'
      )
      v-timeline-item.comments-post(
        color='pink darken-4'
        :large='!cm.isReply'
        :small='cm.isReply'
        :class='{ "is-reply": cm.isReply }'
        v-for='cm of orderedComments'
        :key='`comment-` + cm.id'
        :id='`comment-post-id-` + cm.id'
        )
        template(v-slot:icon)
          v-avatar(color='blue-grey', :size='cm.isReply ? 32 : 48')
            span.white--text(:class='cm.isReply ? `caption` : `title`') {{cm.initials}}
        v-card.elevation-1
          v-card-text
            .comments-post-actions(v-if='canChange(cm) && !isBusy && commentEditId === 0')
              v-icon.mr-3(small, @click='editComment(cm)') mdi-pencil
              v-icon(small, @click='deleteCommentConfirm(cm)') mdi-delete
            .comments-post-name.caption: strong {{cm.authorName}}
            .comments-post-date.overline.grey--text {{cm.createdAt | date('from') }} #[em(v-if='cm.createdAt !== cm.updatedAt') - {{$t('common:comments.modified', { reldate: $options.filters.date(cm.updatedAt, 'from') })}}]
            .comments-post-content.mt-3(v-if='commentEditId !== cm.id', v-html='cm.render')
            .comments-post-editcontent.mt-3(v-else)
              v-textarea(
                outlined
                flat
                auto-grow
                dense
                rows='3'
                hide-details
                v-model='commentEditContent'
                color='blue-grey darken-2'
                :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
              )
              .d-flex.align-center.pt-3
                v-spacer
                v-btn.mr-3(
                  dark
                  color='blue-grey darken-2'
                  @click='editCommentCancel'
                  outlined
                  )
                  v-icon(left) mdi-close
                  span.text-none {{$t('common:actions.cancel')}}
                v-btn(
                  dark
                  color='blue-grey darken-2'
                  @click='updateComment'
                  depressed
                  )
                  v-icon(left) mdi-comment
                  span.text-none {{$t('common:comments.updateComment')}}
            .comments-post-replybtn.mt-2(v-if='permissions.write && commentEditId !== cm.id && replyToId !== cm.id')
              v-btn.px-1(text, x-small, color='blue-grey', @click='startReply(cm)')
                v-icon(left, x-small) mdi-reply
                span.text-none {{$t('common:comments.reply', { defaultValue: 'Reply' })}}
            .comments-post-replyform.mt-3(v-if='replyToId === cm.id')
              v-textarea(
                outlined
                flat
                auto-grow
                dense
                rows='2'
                hide-details
                autofocus
                v-model='replyContent'
                color='blue-grey darken-2'
                :placeholder='$t(`common:comments.replyPlaceholder`, { defaultValue: `Write a reply...` })'
                :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
              )
              .d-flex.align-center.pt-2
                v-spacer
                v-btn.mr-2(text, small, color='blue-grey', @click='cancelReply') {{$t('common:actions.cancel')}}
                v-btn(small, dark, depressed, color='blue-grey darken-2', @click='postReply', :loading='isBusy')
                  v-icon(left, small) mdi-reply
                  span.text-none {{$t('common:comments.postReply', { defaultValue: 'Reply' })}}
    .pt-5.text-center.body-2.blue-grey--text(v-else-if='permissions.write') {{$t('common:comments.beFirst')}}
    .text-center.body-2.blue-grey--text(v-else) {{$t('common:comments.none')}}

    v-dialog(v-model='deleteCommentDialogShown', max-width='500')
      v-card
        .dialog-header.is-red {{$t('common:comments.deleteConfirmTitle')}}
        v-card-text.pt-5
          span {{$t('common:comments.deleteWarn')}}
          .caption.mt-2(v-if='commentToDelete.replyCount > 0') {{ deleteRepliesWarn }}
          .caption: strong {{$t('common:comments.deletePermanentWarn')}}
        v-card-chin
          v-spacer
          v-btn(text, @click='deleteCommentDialogShown = false') {{$t('common:actions.cancel')}}
          v-btn(color='red', dark, @click='deleteComment') {{$t('common:actions.delete')}}
</template>

<script>
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'
import validate from 'validate.js'
import _ from 'lodash'
import { initials } from '@/helpers'

export default {
  data () {
    return {
      newcomment: '',
      isLoading: true,
      hasLoadedOnce: false,
      comments: [],
      guestName: '',
      guestEmail: '',
      commentToDelete: {},
      replyToId: 0,
      replyContent: '',
      commentEditId: 0,
      commentEditContent: null,
      deleteCommentDialogShown: false,
      isBusy: false,
      scrollOpts: {
        duration: 1500,
        offset: 0,
        easing: 'easeInOutCubic'
      }
    }
  },
  computed: {
    pageId: get('page/id'),
    permissions: get('page/effectivePermissions@comments'),
    isAuthenticated: get('user/authenticated'),
    userDisplayName: get('user/name'),
    userId: get('user/id'),
    /**
     * Root comments in chronological order, each followed by its replies
     */
    orderedComments () {
      const ids = new Set(this.comments.map(c => c.id))
      const isRoot = c => !c.replyTo || !ids.has(c.replyTo)
      const result = []
      for (const root of this.comments.filter(isRoot)) {
        const replies = this.comments.filter(c => !isRoot(c) && c.replyTo === root.id)
        result.push({ ...root, isReply: false, replyCount: replies.length })
        for (const reply of replies) {
          result.push({ ...reply, isReply: true, replyCount: 0 })
        }
      }
      return result
    },
    deleteRepliesWarn () {
      return this.$t('common:comments.deleteRepliesWarn', {
        count: this.commentToDelete.replyCount,
        defaultValue: 'Its {{count}} replies will be deleted as well.'
      })
    }
  },
  methods: {
    /**
     * Moderators may change any comment, authors their own
     */
    canChange (cm) {
      return this.permissions.manage || (this.isAuthenticated && this.permissions.write && cm.authorId === this.userId)
    },
    onIntersect (entries, observer, isIntersecting) {
      if (isIntersecting) {
        this.fetch(true)
      }
    },
    async fetch (silent = false) {
      this.isLoading = true
      try {
        const results = await this.$apollo.query({
          query: gql`
            query ($locale: String!, $path: String!) {
              comments {
                list(locale: $locale, path: $path) {
                  id
                  replyTo
                  render
                  authorId
                  authorName
                  createdAt
                  updatedAt
                }
              }
            }
          `,
          variables: {
            locale: this.$store.get('page/locale'),
            path: this.$store.get('page/path')
          },
          fetchPolicy: 'network-only'
        })
        this.comments = _.get(results, 'data.comments.list', []).map(c => ({
          ...c,
          initials: initials(c.authorName)
        }))
      } catch (err) {
        console.warn(err)
        if (!silent) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: err.message,
            icon: 'alert'
          })
        }
      }
      this.isLoading = false
      this.hasLoadedOnce = true
    },
    /**
     * Post New Comment
     */
    async postComment () {
      const id = await this.submitComment({ content: this.newcomment, replyTo: 0 })
      if (id) {
        this.newcomment = ''
      }
    },
    startReply (cm) {
      this.replyToId = cm.id
      this.replyContent = ''
    },
    cancelReply () {
      this.replyToId = 0
      this.replyContent = ''
    },
    async postReply () {
      this.isBusy = true
      const id = await this.submitComment({ content: this.replyContent, replyTo: this.replyToId })
      if (id) {
        this.cancelReply()
      }
      this.isBusy = false
    },
    /**
     * Validate and post a comment or reply, returns the new comment ID
     */
    async submitComment ({ content, replyTo }) {
      let rules = {
        comment: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2
          }
        }
      }
      if (!this.isAuthenticated && this.permissions.write) {
        rules.name = {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
        rules.email = {
          presence: {
            allowEmpty: false
          },
          email: true
        }
      }
      const validationResults = validate({
        comment: content,
        name: this.guestName,
        email: this.guestEmail
      }, rules, { format: 'flat' })

      if (validationResults) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: validationResults[0],
          icon: 'alert'
        })
        return 0
      }

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $pageId: Int!
              $replyTo: Int
              $content: String!
              $guestName: String
              $guestEmail: String
            ) {
              comments {
                create (
                  pageId: $pageId
                  replyTo: $replyTo
                  content: $content
                  guestName: $guestName
                  guestEmail: $guestEmail
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  id
                }
              }
            }
          `,
          variables: {
            pageId: this.pageId,
            replyTo,
            content,
            guestName: this.guestName,
            guestEmail: this.guestEmail
          }
        })

        if (_.get(resp, 'data.comments.create.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('common:comments.postSuccess'),
            icon: 'check'
          })

          const newId = _.get(resp, 'data.comments.create.id', 0)
          await this.fetch()
          this.$nextTick(() => {
            this.$vuetify.goTo(`#comment-post-id-${newId}`, this.scrollOpts)
          })
          return newId
        } else {
          throw new Error(_.get(resp, 'data.comments.create.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
    },
    /**
     * Show Comment Editing Form
     */
    async editComment (cm) {
      this.$store.commit(`loadingStart`, 'comments-edit')
      this.isBusy = true
      try {
        const results = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
              comments {
                single(id: $id) {
                  content
                }
              }
            }
          `,
          variables: {
            id: cm.id
          },
          fetchPolicy: 'network-only'
        })
        this.commentEditContent = _.get(results, 'data.comments.single.content', null)
        if (this.commentEditContent === null) {
          throw new Error('Failed to load comment content.')
        }
      } catch (err) {
        console.warn(err)
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.commentEditId = cm.id
      this.isBusy = false
      this.$store.commit(`loadingStop`, 'comments-edit')
    },
    /**
     * Cancel Comment Edit
     */
    editCommentCancel () {
      this.commentEditId = 0
      this.commentEditContent = null
    },
    /**
     * Update Comment with new content
     */
    async updateComment () {
      this.$store.commit(`loadingStart`, 'comments-edit')
      this.isBusy = true
      try {
        if (this.commentEditContent.length < 2) {
          throw new Error(this.$t('common:comments.contentMissingError'))
        }
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int!
              $content: String!
            ) {
              comments {
                update (
                  id: $id,
                  content: $content
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  render
                }
              }
            }
          `,
          variables: {
            id: this.commentEditId,
            content: this.commentEditContent
          }
        })

        if (_.get(resp, 'data.comments.update.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('common:comments.updateSuccess'),
            icon: 'check'
          })

          const cm = _.find(this.comments, ['id', this.commentEditId])
          cm.render = _.get(resp, 'data.comments.update.render', '-- Failed to load updated comment --')
          cm.updatedAt = (new Date()).toISOString()

          this.editCommentCancel()
        } else {
          throw new Error(_.get(resp, 'data.comments.delete.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        console.warn(err)
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.isBusy = false
      this.$store.commit(`loadingStop`, 'comments-edit')
    },
    /**
     * Show Delete Comment Confirmation Dialog
     */
    deleteCommentConfirm (cm) {
      this.commentToDelete = cm
      this.deleteCommentDialogShown = true
    },
    /**
     * Delete Comment
     */
    async deleteComment () {
      this.$store.commit(`loadingStart`, 'comments-delete')
      this.isBusy = true
      this.deleteCommentDialogShown = false

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int!
            ) {
              comments {
                delete (
                  id: $id
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.commentToDelete.id
          }
        })

        if (_.get(resp, 'data.comments.delete.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('common:comments.deleteSuccess'),
            icon: 'check'
          })

          this.comments = _.reject(this.comments, ['id', this.commentToDelete.id])
        } else {
          throw new Error(_.get(resp, 'data.comments.delete.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.isBusy = false
      this.$store.commit(`loadingStop`, 'comments-delete')
    }
  }
}
</script>

<style lang="scss">
.comments-post {
  position: relative;

  &.is-reply {
    margin-left: 48px;
    padding-top: 0;
  }

  &:hover {
    .comments-post-actions {
      opacity: 1;
    }
  }

  &-actions {
    position: absolute;
    top: 16px;
    right: 16px;
    opacity: 0;
    transition: opacity .4s ease;
  }

  &-content {
    > p:first-child {
      padding-top: 0;
    }

    p {
      padding-top: 1rem;
      margin-bottom: 0;
    }

    img {
      max-width: 100%;
      border-radius: 5px;
    }

    code {
      background-color: rgba(mc('pink', '500'), .1);
      box-shadow: none;
    }

    pre > code {
      margin-top: 1rem;
      padding: 12px;
      background-color: #111;
      box-shadow: none;
      border-radius: 5px;
      width: 100%;
      color: #FFF;
      font-weight: 400;
      font-size: .85rem;
      font-family: Roboto Mono, monospace;
    }
  }
}
</style>
