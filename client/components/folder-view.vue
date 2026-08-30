<template lang="pug">
  v-app(:dark='$vuetify.theme.dark', :class='$vuetify.rtl ? `is-rtl` : `is-ltr`')
    nav-header
    v-navigation-drawer(
      v-if='navMode !== `NONE`'
      :class='$vuetify.theme.dark ? `grey darken-4-d4` : `primary`'
      dark
      app
      clipped
      mobile-breakpoint='600'
      :temporary='$vuetify.breakpoint.smAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(:color='$vuetify.theme.dark ? `grey darken-4-d4` : `primary`', :items='sidebarDecoded', :nav-mode='navMode')

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

    v-main
      v-toolbar(:color='$vuetify.theme.dark ? `grey darken-4-d3` : `grey lighten-3`', flat, dense, v-if='$vuetify.breakpoint.smAndUp')
        page-breadcrumbs(:locale='locale', :path='path', current-disabled)
      v-divider
      v-container.grey.pa-0(fluid, :class='$vuetify.theme.dark ? `darken-4-l3` : `lighten-4`')
        v-row.page-header-section(no-gutters, align-content='center')
          v-col.is-page-header.py-4(:class='$vuetify.rtl ? `pr-4` : `pl-4`')
            .d-flex.align-center
              v-icon.mr-3(size='40', color='primary') mdi-folder-open-outline
              div
                .headline.grey--text(:class='$vuetify.theme.dark ? `text--lighten-2` : `text--darken-3`') {{folderTitle}}
                .caption.grey--text.text--darken-1 /{{path}}
              v-spacer
              v-btn.mr-3(
                v-if='hasWritePagesPermission'
                color='primary'
                depressed
                :href='createPageUrl'
                )
                v-icon(left) mdi-plus
                span {{$t('common:folderView.createPage', { defaultValue: 'Create this page' })}}
      v-divider
      v-container.pt-5(fluid, grid-list-xl)
        v-progress-linear(v-if='isLoading', indeterminate, color='primary')
        template(v-else)
          template(v-if='folders.length')
            .overline.pb-2(:class='$vuetify.theme.dark ? `accent--text` : `primary--text`') {{$t('common:folderView.folders', { defaultValue: 'Folders' })}}
            v-row(dense)
              v-col(cols='12', sm='6', md='4', lg='3', v-for='item of folders', :key='`folder-` + item.id')
                v-card.folder-view-card(outlined, hover, :href='itemUrl(item)')
                  v-card-text.d-flex.align-center
                    v-icon.mr-3(color='primary') mdi-folder
                    .subtitle-2.text-truncate {{item.title}}
          template(v-if='pages.length')
            .overline.pb-2.pt-4(:class='$vuetify.theme.dark ? `accent--text` : `primary--text`') {{$t('common:folderView.pages', { defaultValue: 'Pages' })}}
            v-row(dense)
              v-col(cols='12', sm='6', md='4', lg='3', v-for='item of pages', :key='`page-` + item.id')
                v-card.folder-view-card(outlined, hover, :href='itemUrl(item)')
                  v-card-text
                    .d-flex.align-center
                      v-icon.mr-3(color='grey darken-1') mdi-text-box-outline
                      .subtitle-2.text-truncate {{item.title}}
                    .caption.grey--text.mt-2.folder-view-card-description(v-if='item.description') {{item.description}}
                    .caption.grey--text.text--lighten-1.mt-1(v-if='item.updatedAt') {{item.updatedAt | moment('calendar')}}
          v-row(v-if='!folders.length && !pages.length', justify='center')
            v-col(cols='12', md='6')
              v-card.text-center.pa-8(outlined)
                v-icon(size='72', color='grey lighten-1') mdi-folder-outline
                .subtitle-1.mt-3.grey--text.text--darken-2 {{$t('common:folderView.empty', { defaultValue: 'This folder has no pages you can view.' })}}
                v-btn.mt-4(v-if='hasWritePagesPermission', color='primary', depressed, :href='createPageUrl')
                  v-icon(left) mdi-plus
                  span {{$t('common:folderView.createPage', { defaultValue: 'Create this page' })}}

    nav-footer
    notify
    search-results
</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'
import NavSidebar from '@/themes/default/components/nav-sidebar.vue'
import PageBreadcrumbs from '@/components/common/page-breadcrumbs.vue'

import treeByPathQuery from 'gql/common/common-pages-query-tree-by-path.gql'

/* global siteLangs */

export default {
  components: {
    NavSidebar,
    PageBreadcrumbs
  },
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
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
    effectivePermissions: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      locales: siteLangs,
      navShown: false,
      winWidth: 0,
      isLoading: true,
      children: [],
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01,
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#5B85E8',
          hoverStyle: {
            background: '#7FA0EC'
          }
        }
      }
    }
  },
  computed: {
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    folderTitle () {
      return _.startCase(_.last(this.path.split('/')))
    },
    createPageUrl () {
      return `/e/${this.locale}/${this.path}`
    },
    folders () {
      return this.children.filter(c => c.isFolder)
    },
    pages () {
      return this.children.filter(c => !c.isFolder && c.pageId)
    },
    sidebarDecoded () {
      return JSON.parse(Buffer.from(this.sidebar, 'base64').toString())
    }
  },
  created () {
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/title', this.folderTitle)
    this.$store.set('page/mode', 'view')
    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
  },
  mounted () {
    if (this.$vuetify.theme.dark) {
      this.scrollStyle.bar.background = '#424242'
    }
    this.handleSideNavVisibility()
    window.addEventListener('resize', _.debounce(() => {
      this.handleSideNavVisibility()
    }, 500))
  },
  methods: {
    itemUrl (item) {
      return (this.locales.length > 0 ? `/${item.locale}` : '') + `/${item.path}`
    },
    handleSideNavVisibility () {
      if (window.innerWidth === this.winWidth) { return }
      this.winWidth = window.innerWidth
      this.navShown = this.$vuetify.breakpoint.mdAndUp
    }
  },
  apollo: {
    children: {
      query: treeByPathQuery,
      variables () {
        return {
          path: this.path,
          locale: this.locale
        }
      },
      fetchPolicy: 'cache-and-network',
      update: (data) => _.get(data, 'pages.treeByPath.children', []),
      watchLoading (isLoading) {
        this.isLoading = isLoading
      }
    }
  }
}
</script>

<style lang="scss">
.folder-view-card {
  display: block;

  &:hover {
    border-color: mc('theme', 'primary');
  }

  &-description {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
</style>
