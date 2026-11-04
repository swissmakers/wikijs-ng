<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.revertTitle') }}
    v-card-text
      .body-2 Rolls every page that a user changed since a given date back to the version it had right before that date. Use it to undo the edits of an automated tool or a faulty import in one go.
      .body-2.mt-2 Each revert is saved as a normal restore: the overwritten version stays in the page history, so it can be undone page by page.

      v-row.mt-3
        v-col(cols='12', md='6')
          v-autocomplete(
            v-model='authorId'
            :items='users'
            item-value='id'
            :item-text='u => `${u.name} (${u.email})`'
            label='Changes made by'
            outlined
            dense
            hide-details
            prepend-inner-icon='mdi-account'
          )
        v-col(cols='6', md='3')
          v-text-field(
            v-model='sinceDate'
            type='date'
            label='Since'
            outlined
            dense
            hide-details
          )
        v-col(cols='6', md='3')
          v-text-field(
            v-model='sinceTime'
            type='time'
            label='Time'
            outlined
            dense
            hide-details
          )
        v-col(cols='12', md='6')
          v-text-field(
            v-model='pathPrefix'
            label='Only below path (optional)'
            placeholder='e.g. 20-knowledge-base'
            outlined
            dense
            hide-details
            prepend-inner-icon='mdi-folder-outline'
          )
        v-col(cols='12', md='6')
          v-checkbox.mt-1(
            v-model='includeOthers'
            label='Also revert pages that other users edited afterwards'
            hide-details
            dense
          )

      v-btn.ml-0.mt-4(outlined, color='primary', @click='preview', :disabled='!canPreview || loading', :loading='loading && !isReverting')
        v-icon(left) mdi-magnify
        span Preview affected pages

      template(v-if='items !== null')
        v-divider.my-5
        .d-flex.align-center.flex-wrap
          .subtitle-1.primary--text {{ items.length }} page(s) changed
          v-chip.ml-3(small, label, v-for='(count, status) in statusCounts', :key='status', :color='statusColor(status)', dark) {{ statusLabel(status) }}: {{ count }}
          v-spacer
          v-btn(color='orange darken-2', dark, depressed, @click='isConfirmShown = true', :disabled='selected.length < 1 || loading')
            v-icon(left) mdi-history
            span Revert {{ selected.length }} page(s)
        v-data-table.mt-3(
          v-model='selected'
          :headers='headers'
          :items='items'
          item-key='pageId'
          item-selectable='selectable'
          show-select
          dense
          :items-per-page='50'
          :footer-props='{ itemsPerPageOptions: [25, 50, 100, -1] }'
          )
          template(v-slot:item.path='{ item }')
            .body-2 {{ item.title }}
            .caption.grey--text /{{ item.locale }}/{{ item.path }}
          template(v-slot:item.status='{ item }')
            v-chip(x-small, label, :color='statusColor(item.status)', dark) {{ statusLabel(item.status) }}
            .caption.grey--text(v-if='item.otherAuthors.length > 0') Also edited by {{ item.otherAuthors.join(', ') }}
            .caption.red--text(v-if='item.message') {{ item.message }}
          template(v-slot:item.baselineDate='{ item }')
            span(v-if='item.baselineDate') {{ item.baselineDate | date('LLL') }}
            span.grey--text(v-else) —
          template(v-slot:item.actions='{ item }')
            v-btn(icon, small, :href='`/h/${item.locale}/${item.path}`', target='_blank', title='Open history')
              v-icon(small) mdi-history

    v-dialog(v-model='isConfirmShown', max-width='550', persistent)
      v-card
        .dialog-header.is-orange Revert {{ selected.length }} page(s)?
        v-card-text.pa-4
          .body-2 Each selected page is restored to the version it had before #[strong {{ sinceLabel }}].
          .body-2.mt-2 The current versions stay in the page history. With git storage enabled, the reverts are synced like regular edits.
        v-card-actions
          v-spacer
          v-btn(text, @click='isConfirmShown = false', :disabled='isReverting') {{ $t('common:actions.cancel') }}
          v-btn(color='orange darken-2', dark, @click='revert', :loading='isReverting') Revert
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

const revertMutation = gql`
  mutation ($authorId: Int!, $since: Date!, $pathPrefix: String, $includeOthers: Boolean, $pageIds: [Int!], $dryRun: Boolean!) {
    pages {
      revertChanges(authorId: $authorId, since: $since, pathPrefix: $pathPrefix, includeOthers: $includeOthers, pageIds: $pageIds, dryRun: $dryRun) {
        responseResult {
          succeeded
          message
        }
        items {
          pageId
          path
          locale
          title
          status
          changes
          otherAuthors
          baselineVersionId
          baselineDate
          message
        }
      }
    }
  }
`

const STATUS = {
  revert: { label: 'Will revert', color: 'orange darken-2' },
  reverted: { label: 'Reverted', color: 'green' },
  conflict: { label: 'Edited by others', color: 'grey darken-1' },
  created: { label: 'Created since', color: 'blue-grey' },
  failed: { label: 'Failed', color: 'red' }
}

export default {
  data () {
    return {
      users: [],
      authorId: null,
      sinceDate: '',
      sinceTime: '00:00',
      pathPrefix: '',
      includeOthers: false,
      items: null,
      selected: [],
      loading: false,
      isReverting: false,
      isConfirmShown: false,
      headers: [
        { text: 'Page', value: 'path' },
        { text: 'Status', value: 'status', width: 170 },
        { text: 'Edits', value: 'changes', width: 70, align: 'center' },
        { text: 'Back to', value: 'baselineDate', width: 170 },
        { text: '', value: 'actions', width: 50, sortable: false }
      ]
    }
  },
  computed: {
    canPreview () {
      return this.authorId && this.sinceDate
    },
    since () {
      // -> Date and time are entered in the browser's timezone
      return new Date(`${this.sinceDate}T${this.sinceTime || '00:00'}`).toISOString()
    },
    sinceLabel () {
      return this.canPreview ? this.$options.filters.date(this.since, 'LLL') : ''
    },
    statusCounts () {
      return _.countBy(this.items, 'status')
    }
  },
  watch: {
    authorId () { this.items = null },
    sinceDate () { this.items = null },
    sinceTime () { this.items = null },
    pathPrefix () { this.items = null },
    includeOthers () { this.items = null }
  },
  methods: {
    statusLabel (status) {
      return _.get(STATUS, [status, 'label'], status)
    },
    statusColor (status) {
      return _.get(STATUS, [status, 'color'], 'grey')
    },
    async run (dryRun, pageIds = null) {
      const resp = await this.$apollo.mutate({
        mutation: revertMutation,
        variables: {
          authorId: this.authorId,
          since: this.since,
          pathPrefix: this.pathPrefix,
          includeOthers: this.includeOthers,
          pageIds,
          dryRun
        }
      })
      const result = _.get(resp, 'data.pages.revertChanges', {})
      if (!_.get(result, 'responseResult.succeeded', false)) {
        throw new Error(_.get(result, 'responseResult.message', 'An unexpected error occurred.'))
      }
      return _.map(result.items || [], item => ({ ...item, selectable: item.status === 'revert' }))
    },
    async preview () {
      this.loading = true
      this.$store.commit('loadingStart', 'admin-utilities-revert-preview')
      try {
        this.items = await this.run(true)
        this.selected = _.filter(this.items, ['status', 'revert'])
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit('loadingStop', 'admin-utilities-revert-preview')
      this.loading = false
    },
    async revert () {
      this.loading = true
      this.isReverting = true
      this.$store.commit('loadingStart', 'admin-utilities-revert')
      try {
        const results = await this.run(false, _.map(this.selected, 'pageId'))
        const byId = _.keyBy(results, 'pageId')
        this.items = _.map(this.items, item => byId[item.pageId] || item)
        this.selected = []
        const failed = _.filter(results, ['status', 'failed']).length
        this.$store.commit('showNotification', {
          message: failed > 0 ? `${results.length - failed} page(s) reverted, ${failed} failed.` : `${results.length} page(s) reverted.`,
          style: failed > 0 ? 'warning' : 'success',
          icon: failed > 0 ? 'alert' : 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.isConfirmShown = false
      this.$store.commit('loadingStop', 'admin-utilities-revert')
      this.isReverting = false
      this.loading = false
    }
  },
  apollo: {
    users: {
      query: gql`
        query {
          users {
            list {
              id
              name
              email
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.sortBy(data.users.list, 'name')
    }
  }
}
</script>
