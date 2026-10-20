<template lang="pug">
  v-app.wiki-page(v-scroll='upBtnScroll', :dark='$vuetify.theme.dark', :class='[$vuetify.rtl ? `is-rtl` : `is-ltr`, `toc-${tocPosition}`]')
    nav-header(v-if='!printView')
    v-navigation-drawer.wiki-sidebar(
      v-if='navMode !== `NONE` && !printView'
      :dark='$vuetify.theme.dark'
      app
      clipped
      mobile-breakpoint='600'
      :temporary='$vuetify.breakpoint.smAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(color='wiki-sidebar-list', :dark='$vuetify.theme.dark', :items='sidebarDecoded', :nav-mode='navMode')

    v-fab-transition(v-if='navMode !== `NONE`')
      v-btn(
        fab
        color='primary'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='$vuetify.breakpoint.mdAndDown'
        v-show='!navShown'
        )
        v-icon mdi-menu

    v-main(ref='content')
      template(v-if='path !== `home`')
        v-toolbar.wiki-breadcrumbs(flat, dense, v-if='$vuetify.breakpoint.smAndUp')
          page-breadcrumbs(:locale='locale', :path='path')
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text {{$t('common:page.unpublished')}}
            status-indicator.ml-3(negative, pulse)
      v-container.wiki-page-header.pa-0(fluid)
        v-row.page-header-section(no-gutters, align-content='center')
          v-col.page-col-content.is-page-header
            .page-header-headings
              h1.page-header-title {{title}}
              .page-header-description.wiki-muted.mt-2(v-if='description') {{description}}
              .page-header-tags.mt-2(v-if='tags.length > 0')
                v-chip.mr-1(
                  label
                  small
                  v-for='(tag, idx) in tags'
                  :href='`/t/` + tag.tag'
                  :key='`tag-` + tag.tag'
                  )
                  v-icon(left, x-small) mdi-tag
                  span {{tag.title}}
                v-chip(
                  label
                  small
                  v-if='tags.length > 1'
                  :href='`/t/` + tags.map(t => t.tag).join(`/`)'
                  :aria-label='$t(`common:page.tagsMatching`)'
                  )
                  v-icon(x-small) mdi-tag-multiple
            .page-edit-shortcuts(
              v-if='editShortcutsObj.editMenuBar'
              :class='tocPosition === `right` ? `is-right` : ``'
              )
              v-btn(
                v-if='editShortcutsObj.editMenuBtn'
                @click='pageEdit'
                depressed
                small
                )
                v-icon.mr-2(small) mdi-pencil
                span.text-none {{$t(`common:actions.edit`)}}
              v-btn(
                v-if='editShortcutsObj.editMenuExternalBtn'
                :href='editMenuExternalUrl'
                target='_blank'
                depressed
                small
                )
                v-icon.mr-2(small) {{ editShortcutsObj.editMenuExternalIcon }}
                span.text-none {{$t(`common:page.editExternal`, { name: editShortcutsObj.editMenuExternalName })}}
      v-container.wiki-document-layout(fluid)
        v-layout.page-layout(row)
          v-flex.page-col-sd(
            v-if='tocPosition !== `off` && $vuetify.breakpoint.lgAndUp'
            )
            v-card.page-toc-card.mb-5(v-if='tocDecoded.length')
              .page-sidebar-heading {{$t('common:page.toc')}}
              v-list(dense, nav)
                template(v-for='(tocItem, tocIdx) in tocDecoded')
                  v-list-item.page-toc-item(
                    @click='$vuetify.goTo(tocItem.anchor, scrollOpts)'
                    :class='activeAnchor === tocItem.anchor ? `is-active` : ``'
                    )
                    v-list-item-title {{tocItem.title}}
                  template(v-for='tocSubItem in tocItem.children')
                    v-list-item.page-toc-item.is-sub(
                      @click='$vuetify.goTo(tocSubItem.anchor, scrollOpts)'
                      :class='activeAnchor === tocSubItem.anchor ? `is-active` : ``'
                      )
                      v-list-item-title {{tocSubItem.title}}

            v-card.page-comments-card.mb-5(v-if='commentsEnabled && commentsPerms.read')
              div
                .page-sidebar-heading.d-flex.align-center
                  span {{$t('common:comments.sdTitle')}}
                .d-flex
                  v-btn.text-none(
                    @click='goToComments()'
                    text
                    style='flex: 1 1 100%;'
                    small
                    )
                    span {{$t('common:comments.viewDiscussion')}}
                  v-tooltip(right, v-if='commentsPerms.write')
                    template(v-slot:activator='{ on }')
                      v-btn.ml-2(
                        @click='goToComments(true)'
                        v-on='on'
                        text
                        small
                        :aria-label='$t(`common:comments.newComment`)'
                        )
                        v-icon(dense) mdi-comment-plus
                    span {{$t('common:comments.newComment')}}

            v-card.page-shortcuts-card(flat)
              v-toolbar(flat, dense)
                v-spacer
                page-follow(:page-id='pageId', :locale='locale', :path='path')
                v-menu(offset-y, bottom, min-width='300')
                  template(v-slot:activator='{ on: menu }')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on: tooltip }')
                        v-btn(icon, tile, v-on='{ ...menu, ...tooltip }', :aria-label='$t(`common:page.share`)'): v-icon(color='grey') mdi-share-variant
                      span {{$t('common:page.share')}}
                  social-sharing(
                    :url='pageUrl'
                    :title='title'
                    :description='description'
                  )
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, v-on='on', @click='print', :aria-label='$t(`common:page.printFormat`)')
                      v-icon(:color='printView ? `primary` : `grey`') mdi-printer
                  span {{$t('common:page.printFormat')}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, v-on='on', @click='exportPdf', :aria-label='$t(`common:page.exportPdf`, { defaultValue: "Export as PDF" })')
                      v-icon(color='grey') mdi-file-pdf-box
                  span {{$t('common:page.exportPdf', { defaultValue: 'Export as PDF' })}}
                v-spacer

          v-flex.page-col-content
            v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasAnyPagePermissions && editShortcutsObj.editFab')
              template(v-slot:activator='{ on: onEditActivator }')
                v-speed-dial(
                  v-model='pageEditFab'
                  direction='top'
                  open-on-hover
                  transition='scale-transition'
                  bottom
                  :right='!$vuetify.rtl'
                  :left='$vuetify.rtl'
                  fixed
                  dark
                  )
                  template(v-slot:activator)
                    v-btn.btn-animate-edit(
                      fab
                      color='primary'
                      v-model='pageEditFab'
                      @click='pageEdit'
                      v-on='onEditActivator'
                      :disabled='!hasWritePagesPermission'
                      :aria-label='$t(`common:page.editPage`)'
                      )
                      v-icon mdi-pencil
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-for='action of pageActions', :key='action.key')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        :color='action.isDanger ? `red` : `white`'
                        :light='!action.isDanger'
                        :dark='action.isDanger'
                        v-on='on'
                        @click='$root.$emit(action.key)'
                        )
                        v-icon(size='20') {{ action.icon }}
                    span {{ action.label }}
              span {{$t('common:page.editPage')}}
            v-alert.mb-5(v-if='!isPublished', color='red', outlined, icon='mdi-minus-circle', dense)
              .caption {{$t('common:page.unpublishedWarning')}}
            v-expansion-panels.page-mobile-toc.mb-6(v-if='tocDecoded.length && tocPosition !== `off` && $vuetify.breakpoint.mdAndDown && !printView', flat)
              v-expansion-panel
                v-expansion-panel-header
                  .page-sidebar-heading {{$t('common:page.toc')}}
                v-expansion-panel-content
                  v-list(dense, nav)
                    template(v-for='(tocItem, tocIdx) in tocDecoded')
                      v-list-item(@click='$vuetify.goTo(tocItem.anchor, scrollOpts)')
                        v-list-item-title {{tocItem.title}}
                      template(v-for='tocSubItem in tocItem.children')
                        v-list-item(@click='$vuetify.goTo(tocSubItem.anchor, scrollOpts)')
                          v-list-item-title.pl-4.caption.wiki-muted {{tocSubItem.title}}
            .contents(ref='container')
              slot(name='contents')
            .page-author-footer.d-flex.align-center(v-if='!printView')
              v-avatar.page-author-avatar.mr-3(size='36')
                span.subtitle-2 {{ authorInitials }}
              div
                .caption.wiki-muted {{$t('common:page.lastEditedBy')}}
                .body-2 {{ authorName }} · {{ updatedAt | date('calendar') }}
                .caption.wiki-muted(v-if='createdLabel') {{ createdLabel }}
              v-spacer
              v-btn(
                text
                small
                color='primary'
                v-if='isAuthenticated && hasReadHistoryPermission'
                :href='"/h/" + locale + "/" + path'
                )
                v-icon(left, small) mdi-history
                span {{$t('common:header.history')}}
            page-backlinks.mt-6(v-if='!printView', :locale='locale', :path='path')
            .comments-container#discussion(v-if='commentsEnabled && commentsPerms.read && !printView')
              .comments-header
                v-icon.mr-2 mdi-comment-text-outline
                span {{$t('common:comments.title')}}
              .comments-main
                slot(name='comments')
    nav-footer
    notify
    search-results
    v-fab-transition
      v-btn(
        v-if='upBtnShown'
        fab
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        :depressed='this.$vuetify.breakpoint.mdAndUp'
        @click='$vuetify.goTo(0, scrollOpts)'
        color='primary'
        dark
        :style='upBtnPosition'
        :aria-label='$t(`common:actions.returnToTop`)'
        )
        v-icon mdi-arrow-up
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import NavSidebar from './nav-sidebar.vue'
import PageBreadcrumbs from '@/components/common/page-breadcrumbs.vue'
import PageBacklinks from './page-backlinks.vue'
import PageFollow from './page-follow.vue'
import pageActionsMixin from '@/helpers/page-actions'
import { decodePermissions, initials } from '@/helpers'
import Prism from 'prismjs'
import mermaid from 'mermaid'
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'

Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'
Prism.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true,
  'remove-initial-line-feed': true,
  'tabs-to-spaces': 2
})

export default {
  mixins: [pageActionsMixin],
  components: {
    NavSidebar,
    PageBacklinks,
    PageFollow,
    PageBreadcrumbs,
    StatusIndicator
  },
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
    creatorName: {
      type: String,
      default: ''
    },
    authorName: {
      type: String,
      default: 'Unknown'
    },
    authorId: {
      type: Number,
      default: 0
    },
    editor: {
      type: String,
      default: ''
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    toc: {
      type: String,
      default: ''
    },
    sidebar: {
      type: String,
      default: ''
    },
    navMode: {
      type: String,
      default: 'MIXED'
    },
    commentsEnabled: {
      type: Boolean,
      default: false
    },
    effectivePermissions: {
      type: String,
      default: ''
    },
    editShortcuts: {
      type: String,
      default: ''
    },
    filename: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      navShown: false,
      upBtnShown: false,
      pageEditFab: false,
      activeAnchor: '',
      tocObserver: null,
      scrollOpts: {
        duration: 1500,
        offset: 0,
        easing: 'easeInOutCubic'
      },
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01, // fix scrollbar not disappearing on load
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#999',
          hoverStyle: {
            background: '#BBB'
          }
        }
      },
      winWidth: 0
    }
  },
  computed: {
    isAuthenticated: get('user/authenticated'),
    commentsPerms: get('page/effectivePermissions@comments'),
    editShortcutsObj: get('page/editShortcuts'),
    pageUrl () { return window.location.href },
    authorInitials () {
      return initials(this.authorName)
    },
    createdLabel () {
      if (!this.createdAt || (this.createdAt === this.updatedAt && (!this.creatorName || this.creatorName === this.authorName))) {
        return ''
      }
      return this.$t('common:page.createdOnBy', {
        date: this.$options.filters.date(this.createdAt, 'LL'),
        name: this.creatorName || this.authorName,
        defaultValue: 'Created on {{date}} by {{name}}',
        interpolation: { escapeValue: false }
      })
    },
    upBtnPosition () {
      if (this.$vuetify.breakpoint.mdAndUp) {
        return this.$vuetify.rtl ? 'right: 235px;' : 'left: 235px;'
      } else {
        return this.$vuetify.rtl ? 'right: 65px;' : 'left: 65px;'
      }
    },
    sidebarDecoded () {
      return JSON.parse(Buffer.from(this.sidebar, 'base64').toString())
    },
    tocDecoded () {
      return JSON.parse(Buffer.from(this.toc, 'base64').toString())
    },
    tocPosition: get('site/tocPosition'),
    printView: sync('site/printView'),
    editMenuExternalUrl () {
      if (this.editShortcutsObj.editMenuBar && this.editShortcutsObj.editMenuExternalBtn) {
        return this.editShortcutsObj.editMenuExternalUrl.replace('{filename}', this.filename)
      } else {
        return ''
      }
    }
  },
  created () {
    this.$store.set('page/authorId', this.authorId)
    this.$store.set('page/authorName', this.authorName)
    this.$store.set('page/createdAt', this.createdAt)
    this.$store.set('page/description', this.description)
    this.$store.set('page/isPublished', this.isPublished)
    this.$store.set('page/id', this.pageId)
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/tags', this.tags)
    this.$store.set('page/title', this.title)
    this.$store.set('page/editor', this.editor)
    this.$store.set('page/updatedAt', this.updatedAt)
    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', decodePermissions(this.effectivePermissions))
    }
    if (this.editShortcuts) {
      this.$store.set('page/editShortcuts', JSON.parse(Buffer.from(this.editShortcuts, 'base64').toString()))
    }

    this.$store.set('page/mode', 'view')
  },
  mounted () {
    this.$root.$on('pageExportPdf', () => {
      this.exportPdf()
    })
    if (this.$vuetify.theme.dark) {
      this.scrollStyle.bar.background = '#424242'
    } else {
      this.scrollStyle.bar.background = this.$vuetify.theme.currentTheme.accent || '#999'
    }

    // -> Track active section for the TOC
    if (this.tocDecoded.length && window.IntersectionObserver) {
      this.tocObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.activeAnchor = `#${entry.target.id}`
            break
          }
        }
      }, { rootMargin: '0px 0px -75% 0px' })
      this.$nextTick(() => {
        this.$refs.container.querySelectorAll('h1[id], h2[id], h3[id]').forEach(el => {
          this.tocObserver.observe(el)
        })
      })
    }

    // -> Check side navigation visibility
    this.handleSideNavVisibility()
    window.addEventListener('resize', _.debounce(() => {
      this.handleSideNavVisibility()
    }, 500))

    // -> Highlight Code Blocks
    Prism.highlightAllUnder(this.$refs.container)

    // -> Render Mermaid diagrams
    mermaid.initialize({
      startOnLoad: false,
      theme: this.$vuetify.theme.dark ? 'dark' : 'default'
    })
    mermaid.run({ querySelector: '.mermaid' })

    // -> Handle anchor scrolling
    if (window.location.hash && window.location.hash.length > 1) {
      if (document.readyState === 'complete') {
        this.$nextTick(() => {
          this.$vuetify.goTo(decodeURIComponent(window.location.hash), this.scrollOpts)
        })
      } else {
        window.addEventListener('load', () => {
          this.$vuetify.goTo(decodeURIComponent(window.location.hash), this.scrollOpts)
        })
      }
    }

    // -> Handle anchor links within the page contents
    this.$nextTick(() => {
      this.$refs.container.querySelectorAll(`a[href^="#"], a[href^="${window.location.href.replace(window.location.hash, '')}#"]`).forEach(el => {
        el.onclick = ev => {
          ev.preventDefault()
          ev.stopPropagation()
          this.$vuetify.goTo(decodeURIComponent(ev.currentTarget.hash), this.scrollOpts)
        }
      })

      window.boot.notify('page-ready')
    })
  },
  beforeDestroy () {
    if (this.tocObserver) {
      this.tocObserver.disconnect()
    }
  },
  methods: {
    upBtnScroll () {
      const scrollOffset = window.pageYOffset || document.documentElement.scrollTop
      this.upBtnShown = scrollOffset > window.innerHeight * 0.33
    },
    print () {
      if (this.printView) {
        this.printView = false
      } else {
        this.printView = true
        this.$nextTick(() => {
          window.print()
        })
      }
    },
    /**
     * Export as PDF through the browser's print dialog ("Save as PDF"),
     * using the print layout and the page title as default file name
     */
    exportPdf () {
      const previousTitle = document.title
      const wasPrintView = this.printView
      document.title = this.title
      this.printView = true
      const restore = () => {
        document.title = previousTitle
        this.printView = wasPrintView
        window.removeEventListener('afterprint', restore)
      }
      window.addEventListener('afterprint', restore)
      this.$nextTick(() => {
        window.print()
      })
    },
    pageEdit () {
      this.$root.$emit('pageEdit')
    },
    handleSideNavVisibility () {
      if (window.innerWidth === this.winWidth) { return }
      this.winWidth = window.innerWidth
      if (this.$vuetify.breakpoint.mdAndUp) {
        this.navShown = true
      } else {
        this.navShown = false
      }
    },
    goToComments (focusNewComment = false) {
      this.$vuetify.goTo('#discussion', this.scrollOpts)
      if (focusNewComment) {
        document.querySelector('#discussion-new').focus()
      }
    }
  }
}
</script>

<style lang="scss">

// The document and its title share one grid; navigation stays outside the reading column.
.v-application.wiki-page.theme--light, .v-application.wiki-page.theme--dark {
  .v-main, .v-main__wrap {
    background-color: var(--wiki-surface);
  }

  .wiki-page-header, .wiki-document-layout {
    width: 100%;
    max-width: 1236px;
    margin-inline: auto;
    padding-inline: 32px !important;
    background-color: var(--wiki-surface);
  }

  .wiki-document-layout {
    padding-top: 0;
    padding-bottom: 56px;
  }

  .page-layout, .page-header-section {
    display: grid;
    grid-template-columns: minmax(0, 920px);
    justify-content: center;
    margin: 0;
  }

  .page-header-section {
    padding-block: 32px 28px;
  }

  .page-col-content {
    min-width: 0;
    width: 100%;
    padding: 0;
  }

  .page-header-title {
    margin: 0;
    color: var(--wiki-text);
    font-size: 2rem;
    line-height: 1.25;
    font-weight: 600;
    letter-spacing: -.5px;
    overflow-wrap: break-word;
  }

  .page-header-description {
    font-size: 1rem;
    line-height: 1.6;
  }

  .page-header-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;

    .v-chip {
      background-color: var(--wiki-surface-alt);
      color: var(--wiki-muted);
      border: 0;
      border-radius: 3px;
      height: 24px;
      font-size: 12px;
    }
  }

  .page-edit-shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;

    .v-btn {
      background-color: var(--wiki-surface-alt);
      color: var(--wiki-text);
      border-radius: 3px;
    }
  }

  .page-col-sd {
    align-self: start;
    position: sticky;
    top: 88px;
    max-height: calc(100vh - 112px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--wiki-border) transparent;
  }

  .page-toc-card.v-card, .page-comments-card.v-card, .page-shortcuts-card.v-card {
    background-color: transparent;
    border: 0;
    box-shadow: none;
    border-radius: 0;

    .v-list, .v-toolbar {
      background-color: transparent;
    }
  }

  .page-sidebar-heading {
    margin-bottom: 12px;
    color: var(--wiki-muted);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .page-toc-card .v-list {
    padding: 0;
  }

  .page-toc-item {
    min-height: 34px;
    margin-bottom: 0 !important;
    padding: 7px 12px;
    border-inline-start: 2px solid var(--wiki-border);
    border-radius: 0 !important;

    .v-list-item__title {
      color: var(--wiki-muted);
      white-space: normal;
      font-size: 13px;
      line-height: 1.5;
    }

    &.is-sub {
      padding-inline-start: 24px;
    }

    &.is-active {
      border-inline-start-color: var(--wiki-link);

      .v-list-item__title {
        color: var(--wiki-text);
        font-weight: 600;
      }
    }
  }

  .page-comments-card {
    padding-top: 8px;

    .v-btn {
      color: var(--wiki-muted);
      padding-inline: 0;
      justify-content: flex-start;
    }
  }

  .page-shortcuts-card {
    border-top: 1px solid var(--wiki-border) !important;

    .v-toolbar__content {
      padding-inline: 0;
    }

    // Five actions must fit the 220px contents column, including watch/bookmark.
    .v-btn--icon {
      width: 40px;
      height: 40px;
    }
  }

  .page-mobile-toc {
    border-block: 1px solid var(--wiki-border);
    border-radius: 0;

    .v-expansion-panel {
      background-color: transparent;
    }

    .v-expansion-panel-header {
      padding: 16px 0;
      min-height: 48px;
    }

    .page-sidebar-heading {
      margin-bottom: 0;
    }
  }

  .page-author-footer {
    border-top: 1px solid var(--wiki-border);
    margin-top: 40px;
    padding-top: 20px;
    gap: 4px;

    .page-author-avatar {
      background-color: var(--wiki-surface-alt);
      color: var(--wiki-muted);
    }
  }

  .page-backlinks .overline.grey--text {
    color: var(--wiki-muted) !important;
  }

  .comments-container {
    margin-top: 40px;
  }

  @media screen and (min-width: 1264px) {
    &.toc-left, &.toc-right {
      .page-layout, .page-header-section {
        column-gap: 32px;
      }
    }

    &.toc-left {
      .page-layout, .page-header-section {
        grid-template-columns: 220px minmax(0, 920px);
      }

      .page-col-content {
        grid-column: 2;
        grid-row: 1;
      }
    }

    &.toc-right {
      .page-layout, .page-header-section {
        grid-template-columns: minmax(0, 920px) 220px;
      }

      .page-col-sd {
        grid-column: 2;
        grid-row: 1;
      }

      .page-col-content {
        grid-column: 1;
        grid-row: 1;
      }
    }
  }

  @media screen and (max-width: 600px) {
    .wiki-page-header, .wiki-document-layout {
      padding-inline: 20px !important;
    }

    .page-header-section {
      padding-block: 24px;
    }

    .page-header-title {
      font-size: 1.75rem;
    }

    .page-author-footer {
      flex-wrap: wrap;
    }
  }
}

@media screen and (max-width: 768px) {
  .v-speed-dial--fixed.v-speed-dial--bottom {
    bottom: 70px;
  }
}

@media print {
  .v-application.wiki-page.theme--light, .v-application.wiki-page.theme--dark {
    .wiki-page-header, .wiki-document-layout {
      max-width: none;
      padding: 0 !important;
    }

    .page-header-section {
      display: block;
      padding-block: 0 20px;
    }
  }
}

</style>
