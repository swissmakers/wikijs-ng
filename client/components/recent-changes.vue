<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').recent-changes
    nav-header
    v-main.grey(:class='$vuetify.theme.dark ? `darken-4-d5` : `lighten-3`')
      v-container.recent-changes-container(fluid, grid-list-lg)
        .d-flex.align-center.flex-wrap.mb-4
          .headline.primary--text {{ $t('common:recent.title', { defaultValue: 'Recent changes' }) }}
          v-spacer
          v-select.mr-3.recent-changes-filter(
            v-if='locales.length > 1'
            v-model='locale'
            :items='locales'
            item-text='name'
            item-value='code'
            dense
            outlined
            hide-details
            clearable
            :label='$t(`common:recent.locale`, { defaultValue: `Language` })'
            )
          v-text-field.mr-3.recent-changes-filter(
            v-model='pathFilter'
            dense
            outlined
            hide-details
            clearable
            prepend-inner-icon='mdi-folder-outline'
            :label='$t(`common:recent.pathFilter`, { defaultValue: `Folder (e.g. docs/setup)` })'
            @keydown.enter='applyFilter'
            @click:clear='applyFilter'
            )
          v-btn(text, color='primary', href='/rss.xml', target='_blank')
            v-icon(left) mdi-rss
            span RSS
        .text-center.pa-8(v-if='isLoading && items.length < 1')
          v-progress-circular(indeterminate, color='primary', size='32', width='2')
        v-card.pa-8.text-center(v-else-if='items.length < 1', flat)
          .body-2.grey--text {{ $t('common:recent.empty', { defaultValue: 'No changes yet.' }) }}
        template(v-for='day of days')
          .overline.grey--text.mt-4.mb-2(:key='`day-` + day.key') {{ day.label }}
          v-card.mb-2(:key='`card-` + day.key', flat)
            v-list(two-line, dense)
              template(v-for='(item, idx) of day.items')
                v-divider(v-if='idx > 0', :key='`div-` + item.id')
                v-list-item(:key='`item-` + item.id', :href='item.action !== `deleted` ? pagePath(item.locale, item.path) : null')
                  v-list-item-avatar(size='36', :color='actionColor(item.action)')
                    v-icon(dark, small) {{ actionIcon(item.action) }}
                  v-list-item-content
                    v-list-item-title
                      span(:class='{ "text-decoration-line-through": item.action === `deleted` }') {{ item.title || item.path }}
                    v-list-item-subtitle
                      span {{ actionLabel(item) }} · {{ item.authorName }}
                      v-chip.ml-2(v-if='item.isSync', x-small, label, outlined) {{ $t('common:recent.sync', { defaultValue: 'storage sync' }) }}
                  v-list-item-action.text-right
                    .caption.grey--text {{ item.createdAt | date('calendar') }}
                    .caption.grey--text /{{ item.locale }}/{{ item.path }}
        .text-center.mt-4(v-if='nextCursor')
          v-btn(outlined, color='primary', :loading='isLoading', @click='load(false)')
            v-icon(left) mdi-chevron-down
            span {{ $t('common:recent.loadMore', { defaultValue: 'Load more' }) }}
    nav-footer
    notify
</template>

<script>
import _ from 'lodash'
import { pagePath } from '@/helpers'
import recentQuery from 'gql/common/common-pages-query-recent.gql'

/* global siteLangs */

const ACTIONS = {
  created: { icon: 'mdi-file-plus-outline', color: 'green' },
  updated: { icon: 'mdi-file-edit-outline', color: 'primary' },
  restored: { icon: 'mdi-history', color: 'teal' },
  moved: { icon: 'mdi-file-move-outline', color: 'orange darken-2' },
  deleted: { icon: 'mdi-file-remove-outline', color: 'red darken-2' }
}

export default {
  i18nOptions: { namespaces: 'common' },
  data () {
    return {
      items: [],
      nextCursor: null,
      isLoading: false,
      locale: null,
      pathFilter: '',
      locales: siteLangs || []
    }
  },
  computed: {
    days () {
      // -> Group by day in the user's time zone
      return _.map(_.groupBy(this.items, item => this.$options.filters.date(item.createdAt, 'L')), (items, key) => ({
        key,
        label: this.$options.filters.date(items[0].createdAt, 'LL'),
        items
      }))
    }
  },
  watch: {
    locale () {
      this.applyFilter()
    }
  },
  mounted () {
    this.load(true)
  },
  methods: {
    pagePath,
    actionIcon (action) {
      return _.get(ACTIONS, [action, 'icon'], 'mdi-file-outline')
    },
    actionColor (action) {
      return _.get(ACTIONS, [action, 'color'], 'grey')
    },
    actionLabel (item) {
      const label = this.$t(`common:notifications.action.${item.action}`, { defaultValue: item.action })
      return item.action === 'moved' && item.previousPath ? `${label} (/${item.previousPath})` : label
    },
    applyFilter () {
      this.load(true)
    },
    async load (reset) {
      this.isLoading = true
      try {
        const resp = await this.$apollo.query({
          query: recentQuery,
          fetchPolicy: 'network-only',
          variables: {
            before: reset ? null : this.nextCursor,
            limit: 50,
            locale: this.locale || null,
            path: _.trim(this.pathFilter || '', '/ ') || null
          }
        })
        const result = _.get(resp, 'data.pages.recentChanges', { items: [], nextCursor: null })
        this.items = reset ? result.items : [...this.items, ...result.items]
        this.nextCursor = result.nextCursor
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.isLoading = false
    }
  }
}
</script>

<style lang='scss'>
.recent-changes .recent-changes-container {
  max-width: 1100px !important;
  margin: 0 auto;
}

.recent-changes-filter {
  max-width: 260px;
}
</style>
