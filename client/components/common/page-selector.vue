<template lang="pug">
  v-dialog(
    v-model='isShown'
    max-width='850px'
    overlay-color='blue darken-4'
    overlay-opacity='.7'
    )
    v-card.page-selector
      .dialog-header
        v-icon.mr-3(color='white') mdi-page-next-outline
        .body-1(v-if='mode === `create`') {{$t('common:pageSelector.createTitle')}}
        .body-1(v-else-if='mode === `move`') {{$t('common:pageSelector.moveTitle')}}
        .body-1(v-else-if='mode === `select`') {{$t('common:pageSelector.selectTitle')}}
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      v-toolbar(flat, :color='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-4`', dense)
        v-text-field(
          ref='searchIpt'
          v-model='searchQuery'
          :label='$t(`common:pageSelector.searchPlaceholder`, { defaultValue: `Search pages by title...` })'
          prepend-inner-icon='mdi-magnify'
          hide-details
          dense
          solo
          flat
          :background-color='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-4`'
          clearable
          single-line
        )
      v-divider
      //- SEARCH RESULTS
      div(v-if='isSearching', style='height: 400px;')
        vue-scroll(:ops='scrollStyle')
          v-list.py-0(dense, two-line)
            template(v-for='(page, idx) of searchResults')
              v-list-item(:key='`sresult-` + page.id', @click='selectSearchResult(page)')
                v-list-item-icon: v-icon(color='primary') mdi-text-box
                v-list-item-content
                  v-list-item-title {{page.title}}
                  v-list-item-subtitle.caption /{{page.path}}
                v-list-item-action(v-if='page.locale')
                  v-chip(x-small, label, outlined) {{page.locale.toUpperCase()}}
              v-divider(v-if='idx < searchResults.length - 1')
            v-list-item(v-if='searchResults.length < 1 && !searchLoading')
              v-list-item-content
                v-list-item-title.grey--text {{$t('common:pageSelector.noResults', { defaultValue: 'No matching pages found.' })}}
      //- BROWSE MODE
      .d-flex(v-else)
        v-flex.grey(xs5, :class='$vuetify.theme.dark ? `darken-4` : `lighten-3`')
          v-toolbar(color='grey darken-3', dark, dense, flat)
            .body-2 {{$t('common:pageSelector.virtualFolders')}}
            v-spacer
          div(style='height:400px;')
            vue-scroll(:ops='scrollStyle')
              v-treeview(
                :key='`pageTree-` + treeViewCacheId'
                :active.sync='currentNode'
                :open.sync='openNodes'
                :items='tree'
                :load-children='fetchFolders'
                dense
                expand-icon='mdi-menu-down-outline'
                item-id='path'
                item-text='title'
                activatable
                hoverable
                )
                template(slot='prepend', slot-scope='{ item, open, leaf }')
                  v-icon mdi-{{ open ? 'folder-open' : 'folder' }}
        v-flex(xs7)
          v-toolbar(color='primary', dark, dense, flat)
            .body-2 {{$t('common:pageSelector.pages')}}
          div(style='height:400px;')
            vue-scroll(:ops='scrollStyle')
              template(v-if='recentPages.length > 0 && currentNode.length > 0 && currentNode[0] === 0')
                .overline.px-4.pt-3.grey--text {{$t('common:pageSelector.recent', { defaultValue: 'Recent' })}}
                v-list.py-0(dense)
                  v-list-item(v-for='page of recentPages', :key='`recent-` + page.locale + page.path', @click='selectRecent(page)')
                    v-list-item-icon: v-icon(color='grey') mdi-history
                    v-list-item-content
                      v-list-item-title {{page.title}}
                      v-list-item-subtitle.caption /{{page.path}}
                v-divider
              v-list.py-0(dense, v-if='currentPages.length > 0')
                v-list-item-group(
                  v-model='currentPage'
                  color='primary'
                  )
                  template(v-for='(page, idx) of currentPages')
                    v-list-item(:key='`page-` + page.id', :value='page')
                      v-list-item-icon: v-icon mdi-text-box
                      v-list-item-content
                        v-list-item-title {{page.title}}
                        v-list-item-subtitle.caption /{{page.path}}
                    v-divider(v-if='idx < pages.length - 1')
              v-alert.animated.fadeIn.ma-3(
                v-else
                text
                color='orange'
                icon='mdi-alert'
                )
                .body-2 {{$t('common:pageSelector.folderEmptyWarning')}}
      v-card-actions.grey.pa-2(:class='$vuetify.theme.dark ? `darken-2` : `lighten-1`', v-if='!mustExist')
        v-select(
          solo
          dark
          flat
          background-color='grey darken-3-d2'
          hide-details
          single-line
          :items='namespaces'
          style='flex: 0 0 100px; border-radius: 4px 0 0 4px;'
          v-model='currentLocale'
          )
        v-text-field(
          ref='pathIpt'
          solo
          hide-details
          prefix='/'
          v-model='currentPath'
          flat
          clearable
          style='border-radius: 0 4px 4px 0;'
        )
      v-card-chin
        v-spacer
        v-btn(text, @click='close') {{$t('common:actions.cancel')}}
        v-btn.px-4(color='primary', @click='open', :disabled='!isValidPath')
          v-icon(left) mdi-check
          span {{$t('common:actions.select')}}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i

/* global siteLangs, siteConfig */

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    path: {
      type: String,
      default: 'new-page'
    },
    locale: {
      type: String,
      default: 'en'
    },
    mode: {
      type: String,
      default: 'create'
    },
    openHandler: {
      type: Function,
      default: () => {}
    },
    mustExist: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      treeViewCacheId: 0,
      searchLoading: false,
      searchQuery: '',
      searchResults: [],
      recentPages: [],
      currentLocale: siteConfig.lang,
      currentFolderPath: '',
      currentPath: 'new-page',
      currentPage: null,
      currentNode: [0],
      openNodes: [0],
      tree: [
        {
          id: 0,
          title: '/ (root)',
          children: []
        }
      ],
      pages: [],
      all: [],
      namespaces: siteLangs.length ? siteLangs.map(ns => ns.code) : [siteConfig.lang],
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
            background: '#64B5F6'
          }
        }
      }
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    isSearching () {
      return this.searchQuery && this.searchQuery.length >= 2
    },
    currentPages () {
      return _.sortBy(_.filter(this.pages, ['parent', _.head(this.currentNode) || 0]), ['title', 'path'])
    },
    isValidPath () {
      if (!this.currentPath) {
        return false
      }
      if (this.mustExist && !this.currentPage) {
        return false
      }
      const firstSection = _.head(this.currentPath.split('/'))
      if (firstSection.length <= 1) {
        return false
      } else if (localeSegmentRegex.test(firstSection)) {
        return false
      } else if (
        _.some(['login', 'logout', 'register', 'verify', 'favicons', 'fonts', 'img', 'js', 'svg'], p => {
          return p === firstSection
        })) {
        return false
      } else {
        return true
      }
    }
  },
  watch: {
    isShown (newValue, oldValue) {
      if (newValue && !oldValue) {
        this.currentPath = this.path
        this.currentLocale = this.locale
        this.searchQuery = ''
        this.loadRecent()
        _.delay(() => {
          if (this.mustExist && this.$refs.searchIpt) {
            this.$refs.searchIpt.focus()
          } else if (this.$refs.pathIpt) {
            this.$refs.pathIpt.focus()
          }
        })
      }
    },
    searchQuery: _.debounce(async function (newValue) {
      if (!newValue || newValue.length < 2) {
        this.searchResults = []
        return
      }
      this.searchLoading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($query: String!, $locale: String) {
              pages {
                search(query: $query, locale: $locale) {
                  results {
                    id
                    title
                    description
                    path
                    locale
                  }
                }
              }
            }
          `,
          fetchPolicy: 'network-only',
          variables: {
            query: newValue,
            locale: siteLangs.length > 0 ? this.currentLocale : null
          }
        })
        this.searchResults = _.get(resp, 'data.pages.search.results', [])
      } catch (err) {
        console.warn(err)
        this.searchResults = []
      }
      this.searchLoading = false
    }, 300),
    currentNode (newValue, oldValue) {
      if (newValue.length < 1) { // force a selection
        this.$nextTick(() => {
          this.currentNode = oldValue
        })
      } else {
        const current = _.find(this.all, ['id', newValue[0]])

        if (this.openNodes.indexOf(newValue[0]) < 0) { // auto open and load children
          if (current) {
            if (this.openNodes.indexOf(current.parent) < 0) {
              this.$nextTick(() => {
                this.openNodes.push(current.parent)
              })
            }
          }
          this.$nextTick(() => {
            this.openNodes.push(newValue[0])
          })
        }

        this.currentPath = _.compact([_.get(current, 'path', ''), _.last(this.currentPath.split('/'))]).join('/')
      }
    },
    currentPage (newValue, oldValue) {
      if (!_.isEmpty(newValue)) {
        this.currentPath = newValue.path
      }
    },
    currentLocale (newValue, oldValue) {
      this.$nextTick(() => {
        this.tree = [
          {
            id: 0,
            title: '/ (root)',
            children: []
          }
        ]
        this.currentNode = [0]
        this.openNodes = [0]
        this.pages = []
        this.all = []
        this.treeViewCacheId += 1
      })
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    open() {
      this.pushRecent({
        locale: this.currentLocale,
        path: this.currentPath,
        title: _.get(this.currentPage, 'title', _.last(this.currentPath.split('/')))
      })
      const exit = this.openHandler({
        locale: this.currentLocale,
        path: this.currentPath,
        id: (this.mustExist && this.currentPage) ? this.currentPage.pageId : 0,
        title: _.get(this.currentPage, 'title', null)
      })
      if (exit !== false) {
        this.close()
      }
    },
    selectSearchResult (page) {
      const applySelection = () => {
        this.currentPage = {
          id: page.id,
          pageId: page.id,
          path: page.path,
          title: page.title
        }
        this.currentPath = page.path
      }
      if (page.locale && page.locale !== this.currentLocale) {
        // The locale watcher resets the tree state on the next tick, apply the selection after it
        this.currentLocale = page.locale
        this.$nextTick(() => {
          this.$nextTick(applySelection)
        })
      } else {
        applySelection()
      }
      this.searchQuery = ''
      this.searchResults = []
    },
    selectRecent (page) {
      this.currentLocale = page.locale || this.currentLocale
      this.currentPath = page.path
      if (this.mustExist) {
        // Recent entries carry no page id, so a fresh selection is still required
        this.searchQuery = page.title
      }
    },
    loadRecent () {
      try {
        this.recentPages = JSON.parse(window.localStorage.getItem('pageSelectorRecent') || '[]')
      } catch (err) {
        this.recentPages = []
      }
    },
    pushRecent (page) {
      try {
        let recent = JSON.parse(window.localStorage.getItem('pageSelectorRecent') || '[]')
        recent = [page, ..._.reject(recent, r => r.path === page.path && r.locale === page.locale)].slice(0, 8)
        window.localStorage.setItem('pageSelectorRecent', JSON.stringify(recent))
        this.recentPages = recent
      } catch (err) {
        // localStorage unavailable - ignore
      }
    },
    async fetchFolders (item) {
      this.searchLoading = true
      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int!, $mode: PageTreeMode!, $locale: String!) {
            pages {
              tree(parent: $parent, mode: $mode, locale: $locale) {
                id
                path
                title
                isFolder
                pageId
                parent
              }
            }
          }
        `,
        fetchPolicy: 'network-only',
        variables: {
          parent: item.id,
          mode: 'ALL',
          locale: this.currentLocale
        }
      })
      const items = _.get(resp, 'data.pages.tree', [])
      const itemFolders = _.filter(items, ['isFolder', true]).map(f => ({...f, children: []}))
      const itemPages = _.filter(items, i => i.pageId > 0)
      if (itemFolders.length > 0) {
        item.children = itemFolders
      } else {
        item.children = undefined
      }
      this.pages = _.unionBy(this.pages, itemPages, 'id')
      this.all = _.unionBy(this.all, items, 'id')

      this.searchLoading = false
    }
  }
}
</script>

<style lang='scss'>

.page-selector {
  .v-treeview-node__label {
    font-size: 13px;
  }
  .v-treeview-node__content {
    cursor: pointer;
  }
}

</style>
