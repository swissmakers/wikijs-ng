<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').history
    nav-header
    v-main
      v-toolbar.history-toolbar(color='primary', dark, flat)
        .history-toolbar-title
          .subheading.text-truncate History of #[strong {{title}}]
          .caption.text-truncate.blue--text.text--lighten-4 /{{locale}}/{{path}}
        v-spacer
        .caption.blue--text.text--lighten-3.mr-4(v-if='$vuetify.breakpoint.mdAndUp') {{total}} versions · ID {{pageId}}
        v-btn(depressed, color='blue darken-1', @click='goLive')
          v-icon(:left='$vuetify.breakpoint.smAndUp') mdi-arrow-left
          span(v-if='$vuetify.breakpoint.smAndUp') Back to page
      v-container(fluid)
        v-row
          v-col(cols='12', md='5', lg='4')
            .caption.grey--text.mb-2 Click a version to compare it with the current page. Use #[strong A] / #[strong B] to compare any two versions.
            .history-trail
              .history-item(
                v-for='ph in fullTrail'
                :key='ph.versionId'
                :class='[`is-` + ph.actionType, { "is-selected": isSelected(ph.versionId) }]'
                @click='selectVersion(ph.versionId)'
                )
                .history-item-dot
                  v-icon(x-small, dark) {{ trailIcon(ph.actionType) }}
                .history-item-body
                  .history-item-head
                    .history-item-date(:title='$options.filters.date(ph.versionDate, `LLL`)')
                      strong {{ ph.versionDate | date('ll') }}
                      span.ml-1 {{ ph.versionDate | date('LT') }}
                    v-spacer
                    v-btn.history-ab(
                      @click.stop='setDiffSource(ph.versionId)'
                      x-small
                      depressed
                      :color='diffSource === ph.versionId ? `pink` : ``'
                      :dark='diffSource === ph.versionId'
                      :disabled='(ph.versionId >= diffTarget && diffTarget !== 0) || ph.versionId === 0'
                      title='Compare from this version (A)'
                      ) A
                    v-btn.history-ab.ml-1(
                      @click.stop='setDiffTarget(ph.versionId)'
                      x-small
                      depressed
                      :color='diffTarget === ph.versionId ? `pink` : ``'
                      :dark='diffTarget === ph.versionId'
                      :disabled='ph.versionId <= diffSource && ph.versionId !== 0'
                      title='Compare to this version (B)'
                      ) B
                    v-menu(offset-y, left)
                      template(v-slot:activator='{ on }')
                        v-btn.ml-1(icon, small, v-on='on', @click.stop): v-icon(small) mdi-dots-vertical
                      v-list(dense, nav).history-promptmenu
                        v-list-item(@click='restore(ph.versionId, ph.versionDate)', :disabled='ph.versionId === 0 || !canWrite')
                          v-list-item-avatar(size='24'): v-icon(:disabled='ph.versionId === 0 || !canWrite') mdi-history
                          v-list-item-title Restore this version
                        v-list-item(@click='editFromVersion(ph.versionId)', :disabled='ph.versionId === 0 || !canWrite')
                          v-list-item-avatar(size='24'): v-icon(:disabled='ph.versionId === 0 || !canWrite') mdi-pencil
                          v-list-item-title Edit from this version
                        v-list-item(@click='viewSource(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-code-tags
                          v-list-item-title View Source
                        v-list-item(@click='download(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-cloud-download-outline
                          v-list-item-title Download Version
                        v-list-item(@click='branchOff(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-source-branch
                          v-list-item-title Branch off from here
                  .history-item-meta
                    template(v-if='ph.actionType === `move`') Moved from #[strong.history-path {{ph.valueBefore}}] to #[strong.history-path {{ph.valueAfter}}] by #[strong {{ ph.authorName }}]
                    template(v-else-if='ph.actionType === `initial`') Created by #[strong {{ ph.authorName }}]
                    template(v-else-if='ph.actionType === `live`') Current version · last edited by #[strong {{ ph.authorName }}]
                    template(v-else) Edited by #[strong {{ ph.authorName }}]

            v-btn.mt-2(
              v-if='total > trail.length'
              block
              depressed
              color='primary'
              @click='loadMore'
              ) Load older versions
            .caption.grey--text.text-center.mt-3(v-else) End of history

          v-col(cols='12', md='7', lg='8')
            v-card.history-detail(flat, outlined)
              v-card-text
                .history-compare
                  .history-compare-side
                    .overline.pink--text A · older
                    .body-2: strong {{ versionLabel(source) }}
                    .caption.grey--text by {{ source.authorName }}
                  v-icon.mx-3 mdi-arrow-right
                  .history-compare-side
                    .overline.pink--text B · newer
                    .body-2: strong {{ versionLabel(target) }}
                    .caption.grey--text by {{ target.authorName }}
                  v-spacer
                  v-btn-toggle(v-model='viewMode', mandatory, dense)
                    v-btn(small, value='line-by-line', title='Source changes, unified')
                      v-icon(small, :left='$vuetify.breakpoint.lgAndUp') mdi-view-agenda-outline
                      span(v-if='$vuetify.breakpoint.lgAndUp') Diff
                    v-btn(v-if='$vuetify.breakpoint.mdAndUp', small, value='side-by-side', title='Source changes, side by side')
                      v-icon(small, :left='$vuetify.breakpoint.lgAndUp') mdi-view-split-vertical
                      span(v-if='$vuetify.breakpoint.lgAndUp') Split diff
                    v-btn(small, value='rendered', title='Rendered pages, side by side')
                      v-icon(small, :left='$vuetify.breakpoint.lgAndUp') mdi-file-eye-outline
                      span(v-if='$vuetify.breakpoint.lgAndUp') Rendered

                v-alert.mt-4.mb-0(v-if='source.versionId > 0 && canWrite', dense, text, color='orange darken-2', border='left')
                  .history-restore
                    .body-2.history-restore-text
                      span Restore the version of #[strong {{ versionLabel(source) }}] to undo all changes after it.
                      span(v-if='target.versionId !== 0')  The comparison below is not against the current page.
                      span.d-block.caption The current page is kept in the history, so a restore can be undone too.
                    .history-restore-actions
                      v-btn(color='orange darken-2', dark, depressed, small, @click='restore(source.versionId, source.versionDate)')
                        v-icon(left, small) mdi-history
                        span Restore
                      v-btn.ml-2(outlined, small, color='orange darken-2', @click='editFromVersion(source.versionId)')
                        v-icon(left, small) mdi-pencil
                        span Edit first

                .history-props.mt-4(v-if='source.title !== target.title || source.description !== target.description')
                  .caption(v-if='source.title !== target.title') Title: #[del {{ source.title }}] → #[strong {{ target.title }}]
                  .caption(v-if='source.description !== target.description') Description: #[del {{ source.description || '(empty)' }}] → #[strong {{ target.description || '(empty)' }}]

              v-divider
              template(v-if='viewMode === `rendered`')
                .history-rendered-bar
                  v-checkbox.mt-0.pt-0(v-model='syncScroll', label='Scroll together', hide-details, dense)
                  v-spacer
                  .caption.grey--text(v-if='!hasChanges && !isLoadingVersion') No content changes between these versions.
                .history-rendered
                  .history-rendered-pane(v-for='side in [`A`, `B`]', :key='side')
                    .history-rendered-head
                      span.pink--text.font-weight-bold.mr-2 {{ side }}
                      span {{ versionLabel(side === `A` ? source : target) }}
                    .history-rendered-scroll(:ref='`pane` + side', @scroll='onPaneScroll(side)')
                      .contents
                        .history-rendered-loading(v-if='!renderOf(side === `A` ? source : target)')
                          v-progress-circular(indeterminate, size='24', width='2', color='primary')
                        div(v-else, v-html='renderOf(side === `A` ? source : target)')
              template(v-else)
                .history-diff(v-if='hasChanges', v-html='diffHTML')
                v-card-text.text-center.grey--text(v-else-if='!isLoadingVersion') No content changes between these versions.

    v-dialog(v-model='isRestoreConfirmDialogShown', max-width='650', persistent)
      v-card
        .dialog-header.is-orange {{$t('history:restore.confirmTitle')}}
        v-card-text.pa-4
          i18next(tag='span', path='history:restore.confirmText')
            strong(place='date') {{ restoreTarget.versionDate | date('LLL') }}
          .caption.mt-3 The page stays at #[strong /{{path}}] and keeps its current tags.
        v-card-actions
          v-spacer
          v-btn(text, @click='isRestoreConfirmDialogShown = false', :disabled='restoreLoading') {{$t('common:actions.cancel')}}
          v-btn(color='orange darken-2', dark, @click='restoreConfirm', :loading='restoreLoading') {{$t('history:restore.confirmButton')}}

    page-selector(mode='create', v-model='branchOffOpts.modal', :open-handler='branchOffHandle', :path='branchOffOpts.path', :locale='branchOffOpts.locale')

    nav-footer
    notify
    search-results
</template>

<script>
import * as Diff2Html from 'diff2html'
import { createPatch } from 'diff'
import _ from 'lodash'
import gql from 'graphql-tag'
import { decodePermissions } from '@/helpers'
import { highlightCode } from '@/helpers/prism'
import Prism from 'prismjs'
import mermaid from 'mermaid'

Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'

const HEADINGS = 'h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'

export default {
  i18nOptions: { namespaces: 'history' },
  props: {
    pageId: {
      type: Number,
      default: 0
    },
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    },
    createdAt: {
      type: String,
      default: ''
    },
    updatedAt: {
      type: String,
      default: ''
    },
    tags: {
      type: Array,
      default: () => ([])
    },
    authorName: {
      type: String,
      default: 'Unknown'
    },
    authorId: {
      type: Number,
      default: 0
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    liveContent: {
      type: String,
      default: ''
    },
    effectivePermissions: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      source: {
        versionId: 0,
        authorName: '',
        content: '',
        title: '',
        description: ''
      },
      target: {
        versionId: 0,
        authorName: '',
        content: '',
        title: '',
        description: ''
      },
      isLoadingVersion: false,
      renders: {},
      syncScroll: true,
      trail: [],
      diffSource: 0,
      diffTarget: 0,
      offsetPage: 0,
      total: 0,
      viewMode: 'line-by-line',
      cache: [],
      restoreTarget: {
        versionId: 0,
        versionDate: ''
      },
      branchOffOpts: {
        versionId: 0,
        locale: 'en',
        path: 'new-page',
        modal: false
      },
      isRestoreConfirmDialogShown: false,
      restoreLoading: false
    }
  },
  computed: {
    fullTrail () {
      const liveTrailItem = {
        versionId: 0,
        authorId: this.authorId,
        authorName: this.authorName,
        actionType: 'live',
        valueBefore: null,
        valueAfter: null,
        versionDate: this.updatedAt
      }
      // -> Check for move between latest and live
      const prevPage = _.find(this.cache, ['versionId', _.get(this.trail, '[0].versionId', -1)])
      if (prevPage && this.path !== prevPage.path) {
        liveTrailItem.actionType = 'move'
        liveTrailItem.valueBefore = prevPage.path
        liveTrailItem.valueAfter = this.path
      }
      // -> Combine trail with live
      return [
        liveTrailItem,
        ...this.trail
      ]
    },
    canWrite () {
      const perms = this.$store.get('page/effectivePermissions')
      return perms.pages.write || perms.pages.manage
    },
    renderedPair () {
      return this.viewMode === 'rendered' ? `${this.source.versionId}:${this.target.versionId}` : ''
    },
    hasChanges () {
      return this.source.content !== this.target.content
    },
    diffs () {
      return createPatch(`/${this.path}`, this.source.content, this.target.content)
    },
    diffHTML () {
      return Diff2Html.html(this.diffs, {
        inputFormat: 'diff',
        drawFileList: false,
        matching: 'lines',
        outputFormat: this.viewMode,
        colorScheme: this.$vuetify.theme.dark ? 'dark' : 'light'
      })
    }
  },
  watch: {
    async renderedPair (newValue) {
      if (!newValue) { return }
      await Promise.all([this.loadRender(this.source.versionId), this.loadRender(this.target.versionId)])
      await this.$nextTick()
      for (const side of ['A', 'B']) {
        const pane = this.$refs[`pane${side}`]
        if (pane && pane[0]) {
          highlightCode(pane[0])
        }
      }
      mermaid.initialize({ startOnLoad: false, theme: this.$vuetify.theme.dark ? 'dark' : 'default' })
      mermaid.run({ querySelector: '.history-rendered .mermaid' })
    },
    syncScroll (newValue) {
      try { localStorage.setItem('history-sync-scroll', newValue ? '1' : '0') } catch (err) {}
      if (newValue) {
        this.onPaneScroll('A')
      }
    },
    trail (newValue, oldValue) {
      // -> Preselect the latest change on first load only (not when loading older versions)
      if (newValue && newValue.length > 0 && (!oldValue || oldValue.length < 1)) {
        this.diffTarget = 0
        this.diffSource = _.get(_.head(newValue), 'versionId', 0)
      }
    },
    async diffSource (newValue, oldValue) {
      if (newValue !== this.source.versionId) {
        const page = await this.getVersion(newValue)
        if (this.diffSource === newValue) {
          this.source = page
        }
      }
    },
    async diffTarget (newValue, oldValue) {
      if (newValue !== this.target.versionId) {
        const page = await this.getVersion(newValue)
        if (this.diffTarget === newValue) {
          this.target = page
        }
      }
    }
  },
  created () {
    this.$store.commit('page/SET_ID', this.pageId)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'history')

    this.cache.push({
      action: 'live',
      authorId: this.authorId,
      authorName: this.authorName,
      content: this.liveContent,
      contentType: '',
      createdAt: this.createdAt,
      description: this.description,
      editor: '',
      isPrivate: false,
      isPublished: this.isPublished,
      locale: this.locale,
      pageId: this.pageId,
      path: this.path,
      publishEndDate: '',
      publishStartDate: '',
      tags: this.tags,
      title: this.title,
      versionId: 0,
      versionDate: this.updatedAt
    })

    this.target = this.cache[0]

    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', decodePermissions(this.effectivePermissions))
    }

    try { this.syncScroll = localStorage.getItem('history-sync-scroll') !== '0' } catch (err) {}
    // -> Set by a pane scrolled programmatically, so its scroll event is not mirrored back
    this.scrollEcho = { A: false, B: false }
  },
  methods: {
    async getVersion (versionId) {
      const page = _.find(this.cache, { versionId })
      if (page) {
        return page
      }
      this.isLoadingVersion = true
      try {
        return await this.loadVersion(versionId)
      } finally {
        this.isLoadingVersion = false
      }
    },
    async loadVersion (versionId) {
      this.$store.commit('loadingStart', 'history-version-' + versionId)
      const resp = await this.$apollo.query({
        query: gql`
          query ($pageId: Int!, $versionId: Int!) {
            pages {
              version (pageId: $pageId, versionId: $versionId) {
                action
                authorId
                authorName
                content
                contentType
                createdAt
                versionDate
                description
                editor
                isPrivate
                isPublished
                locale
                pageId
                path
                publishEndDate
                publishStartDate
                tags
                title
                versionId
              }
            }
          }
        `,
        variables: {
          versionId,
          pageId: this.pageId
        }
      })
      this.$store.commit('loadingStop', 'history-version-' + versionId)
      const page = _.get(resp, 'data.pages.version', null)
      if (page) {
        this.cache.push(page)
        return page
      } else {
        return { versionId, authorName: '', content: '', title: '', description: '' }
      }
    },
    renderOf (version) {
      return this.renders[version.versionId]
    },
    async loadRender (versionId) {
      if (_.has(this.renders, versionId)) { return }
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($pageId: Int!, $versionId: Int!) {
              pages {
                renderVersion (pageId: $pageId, versionId: $versionId)
              }
            }
          `,
          variables: { pageId: this.pageId, versionId }
        })
        this.$set(this.renders, versionId, _.get(resp, 'data.pages.renderVersion', '') || '<p><em>This version is empty.</em></p>')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    /**
     * Scroll positions of headings that exist in both panes, as [scrollTop in from, scrollTop in to] pairs.
     * Scrolling is interpolated between them, so a section added in one version does not shift the other.
     */
    scrollAnchors (from, to) {
      const maxFrom = from.scrollHeight - from.clientHeight
      const maxTo = to.scrollHeight - to.clientHeight
      const offset = (pane, el) => el.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop
      const toHeadings = new Map()
      to.querySelectorAll(HEADINGS).forEach(el => { toHeadings.set(el.id, offset(to, el)) })
      const anchors = [[0, 0]]
      from.querySelectorAll(HEADINGS).forEach(el => {
        if (!toHeadings.has(el.id)) { return }
        const pair = [offset(from, el), toHeadings.get(el.id)]
        const last = _.last(anchors)
        if (pair[0] > last[0] && pair[1] > last[1] && pair[0] < maxFrom && pair[1] < maxTo) {
          anchors.push(pair)
        }
      })
      anchors.push([Math.max(maxFrom, _.last(anchors)[0] + 1), Math.max(maxTo, _.last(anchors)[1])])
      return anchors
    },
    onPaneScroll (side) {
      if (this.scrollEcho[side]) {
        this.scrollEcho[side] = false
        return
      }
      if (!this.syncScroll) { return }
      const other = side === 'A' ? 'B' : 'A'
      const from = _.get(this.$refs, [`pane${side}`, 0])
      const to = _.get(this.$refs, [`pane${other}`, 0])
      if (!from || !to) { return }
      const anchors = this.scrollAnchors(from, to)
      const pos = from.scrollTop
      const idx = Math.max(0, _.findLastIndex(anchors, a => a[0] <= pos))
      const [a, b] = [anchors[idx], anchors[Math.min(idx + 1, anchors.length - 1)]]
      const ratio = b[0] > a[0] ? (pos - a[0]) / (b[0] - a[0]) : 0
      const target = Math.round(a[1] + ratio * (b[1] - a[1]))
      if (Math.abs(to.scrollTop - target) > 1) {
        this.scrollEcho[other] = true
        to.scrollTop = target
      }
    },
    selectVersion (versionId) {
      // -> Compare the clicked version with the current page (the current page with the latest change)
      this.diffTarget = 0
      this.diffSource = versionId > 0 ? versionId : _.get(_.head(this.trail), 'versionId', 0)
    },
    isSelected (versionId) {
      return versionId === this.diffSource || versionId === this.diffTarget
    },
    versionLabel (version) {
      return version.versionId === 0 ? 'Current version' : this.$options.filters.date(version.versionDate, 'LLL')
    },
    editFromVersion (versionId) {
      window.location.assign(`/e/${this.locale}/${this.path}?version=${versionId}`)
    },
    viewSource (versionId) {
      window.location.assign(`/s/${this.locale}/${this.path}?v=${versionId}`)
    },
    download (versionId) {
      window.location.assign(`/d/${this.locale}/${this.path}?v=${versionId}`)
    },
    restore (versionId, versionDate) {
      this.restoreTarget = {
        versionId,
        versionDate
      }
      this.isRestoreConfirmDialogShown = true
    },
    async restoreConfirm () {
      this.restoreLoading = true
      this.$store.commit('loadingStart', 'history-restore')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($pageId: Int!, $versionId: Int!) {
              pages {
                restore (pageId: $pageId, versionId: $versionId) {
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
            versionId: this.restoreTarget.versionId,
            pageId: this.pageId
          }
        })
        if (_.get(resp, 'data.pages.restore.responseResult.succeeded', false) === true) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('history:restore.success'),
            icon: 'check'
          })
          this.isRestoreConfirmDialogShown = false
          setTimeout(() => {
            window.location.assign(`/${this.locale}/${this.path}`)
          }, 1000)
        } else {
          throw new Error(_.get(resp, 'data.pages.restore.responseResult.message', 'An unexpected error occurred'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.$store.commit('loadingStop', 'history-restore')
      this.restoreLoading = false
    },
    branchOff (versionId) {
      const pathParts = this.path.split('/')
      this.branchOffOpts = {
        versionId,
        locale: this.locale,
        path: (pathParts.length > 1) ? _.initial(pathParts).join('/') + '/new-page' : 'new-page',
        modal: true
      }
    },
    branchOffHandle ({ locale, path }) {
      window.location.assign(`/e/${locale}/${path}?from=${this.pageId},${this.branchOffOpts.versionId}`)
    },
    goLive () {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    setDiffSource (versionId) {
      this.diffSource = versionId
    },
    setDiffTarget (versionId) {
      this.diffTarget = versionId
    },
    loadMore () {
      this.offsetPage++
      this.$apollo.queries.trail.fetchMore({
        variables: {
          id: this.pageId,
          offsetPage: this.offsetPage,
          offsetSize: this.$vuetify.breakpoint.mdAndUp ? 25 : 5
        },
        updateQuery: (previousResult, { fetchMoreResult }) => {
          return {
            pages: {
              history: {
                total: previousResult.pages.history.total,
                trail: [...previousResult.pages.history.trail, ...fetchMoreResult.pages.history.trail],
                __typename: previousResult.pages.history.__typename
              },
              __typename: previousResult.pages.__typename
            }
          }
        }
      })
    },
    trailIcon (actionType) {
      switch (actionType) {
        case 'edit':
          return 'mdi-pencil'
        case 'move':
          return 'mdi-arrow-right'
        case 'initial':
          return 'mdi-plus'
        case 'live':
          return 'mdi-check'
        default:
          return 'mdi-alert'
      }
    }
  },
  apollo: {
    trail: {
      query: gql`
        query($id: Int!, $offsetPage: Int, $offsetSize: Int) {
          pages {
            history(id:$id, offsetPage:$offsetPage, offsetSize:$offsetSize) {
              trail {
                versionId
                authorId
                authorName
                actionType
                valueBefore
                valueAfter
                versionDate
              }
              total
            }
          }
        }
      `,
      variables () {
        return {
          id: this.pageId,
          offsetPage: 0,
          offsetSize: this.$vuetify.breakpoint.mdAndUp ? 25 : 5
        }
      },
      manual: true,
      result ({ data, loading, networkStatus }) {
        this.total = data.pages.history.total
        this.trail = data.pages.history.trail
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'history-trail-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

.history {
  &-toolbar {
    .v-toolbar__content {
      min-width: 0;
    }
    &-title {
      min-width: 0;
      flex: 1 1 auto;
    }
  }

  &-promptmenu {
    border-top: 5px solid mc('blue', '700');
  }

  &-trail {
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 12px;
      bottom: 12px;
      left: 11px;
      width: 2px;
      background-color: mc('grey', '300');

      @at-root .theme--dark & {
        background-color: mc('grey', '800');
      }
    }
  }

  &-item {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 4px 0;
    cursor: pointer;

    &-dot {
      flex: 0 0 24px;
      height: 24px;
      margin-top: 10px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: mc('theme', 'primary');
      z-index: 1;
    }

    &.is-live &-dot { background-color: mc('orange', '700'); }
    &.is-move &-dot { background-color: mc('purple', '500'); }
    &.is-initial &-dot { background-color: mc('teal', '500'); }

    &-body {
      flex: 1 1 auto;
      min-width: 0;
      margin-left: 10px;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid transparent;
      background-color: mc('grey', '100');
      transition: border-color .15s ease, background-color .15s ease;

      @at-root .theme--dark & {
        background-color: mc('grey', '900');
      }
    }

    &:hover &-body {
      border-color: mc('grey', '400');

      @at-root .theme--dark & {
        border-color: mc('grey', '700');
      }
    }

    &.is-selected &-body {
      border-color: mc('theme', 'primary');
    }

    &-head {
      display: flex;
      align-items: center;
      min-height: 28px;
    }

    &-date {
      min-width: 0;
      font-size: .85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &-meta {
      font-size: .8rem;
      line-height: 1.4;
      opacity: .85;
      overflow-wrap: anywhere;
    }
  }

  &-path {
    font-family: 'Roboto Mono', monospace;
    font-weight: 500;
  }

  &-ab.v-btn.v-size--x-small {
    min-width: 24px !important;
    padding: 0 !important;
    font-weight: 700;
  }

  &-compare {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    row-gap: 8px;

    &-side {
      min-width: 0;
    }
  }

  &-restore {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    &-text {
      flex: 1 1 260px;
    }

    &-actions {
      flex: 0 0 auto;
    }
  }

  &-rendered-bar {
    display: flex;
    align-items: center;
    padding: 8px 16px;
  }

  &-rendered {
    display: flex;
    border-top: 1px solid rgba(0, 0, 0, .12);

    @at-root .theme--dark & {
      border-top-color: rgba(255, 255, 255, .12);
    }

    @media (max-width: 959px) {
      flex-direction: column;
    }

    &-pane {
      flex: 1 1 50%;
      min-width: 0;

      & + & {
        border-left: 1px solid rgba(0, 0, 0, .12);

        @at-root .theme--dark & {
          border-left-color: rgba(255, 255, 255, .12);
        }

        @media (max-width: 959px) {
          border-left: none;
          border-top: 1px solid rgba(0, 0, 0, .12);
        }
      }
    }

    &-head {
      font-size: .8rem;
      padding: 6px 16px;
      background-color: rgba(0, 0, 0, .03);

      @at-root .theme--dark & {
        background-color: rgba(255, 255, 255, .04);
      }
    }

    &-scroll {
      height: calc(100vh - 290px);
      min-height: 420px;
      overflow: auto;
      padding: 16px 20px;
    }

    &-loading {
      display: flex;
      justify-content: center;
      padding: 32px 0;
    }
  }

  &-diff {
    overflow-x: auto;

    .d2h-file-wrapper {
      border: none;
      border-radius: 0;
      margin-bottom: 0;
    }

    .d2h-file-header {
      display: none;
    }
  }
}

</style>
