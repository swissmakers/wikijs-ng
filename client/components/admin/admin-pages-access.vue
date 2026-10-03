<template lang='pug'>
  v-card.animated.fadeInUp.wait-p3s
    v-toolbar(color='primary', dense, dark, flat)
      v-icon.mr-2 mdi-shield-search
      span {{ $t('admin:pages.accessInspector', { defaultValue: 'Access Inspector' }) }}
    v-card-text
      .caption.grey--text.mb-3 {{ $t('admin:pages.accessInspectorHint', { defaultValue: 'Check what a user or a group may do on this page, and which page rule decides it.' }) }}
      v-row(dense)
        v-col(cols='12', md='4')
          v-btn-toggle(v-model='mode', mandatory, dense, color='primary')
            v-btn(value='group', small) {{ $t('admin:pages.accessGroup', { defaultValue: 'Group' }) }}
            v-btn(value='user', small) {{ $t('admin:pages.accessUser', { defaultValue: 'User' }) }}
        v-col(cols='12', md='8')
          v-select(
            v-if='mode === `group`'
            v-model='groupId'
            :items='groups'
            item-text='name'
            item-value='id'
            outlined
            dense
            hide-details
            :label='$t(`admin:pages.accessGroup`, { defaultValue: "Group" })'
            )
          v-autocomplete(
            v-else
            v-model='userId'
            :items='users'
            :search-input.sync='userSearch'
            :loading='userSearchLoading'
            item-text='name'
            item-value='id'
            no-filter
            outlined
            dense
            hide-details
            hide-no-data
            :label='$t(`admin:pages.accessUserSearch`, { defaultValue: "Search a user by name or e-mail" })'
            )
            template(v-slot:item='{ item }')
              v-list-item-content
                v-list-item-title {{ item.name }}
                v-list-item-subtitle {{ item.email }}
    v-simple-table(v-if='results.length > 0', dense)
      thead
        tr
          th {{ $t('admin:pages.accessPermission', { defaultValue: 'Permission' }) }}
          th {{ $t('admin:pages.accessResult', { defaultValue: 'Result' }) }}
          th {{ $t('admin:pages.accessReason', { defaultValue: 'Decided by' }) }}
      tbody
        tr(v-for='row of results', :key='row.permission')
          td: code {{ row.permission }}
          td
            v-icon(small, :color='row.allowed ? `success` : `red darken-2`') {{ row.allowed ? 'mdi-check-circle' : 'mdi-close-circle' }}
          td.caption {{ reasonLabel(row) }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

import groupsQuery from 'gql/admin/groups/groups-query-list.gql'

export default {
  props: {
    pageId: {
      type: Number,
      required: true
    }
  },
  data () {
    return {
      mode: 'group',
      groupId: null,
      userId: null,
      groups: [],
      users: [],
      userSearch: '',
      userSearchLoading: false,
      results: []
    }
  },
  watch: {
    mode () {
      this.results = []
    },
    groupId (val) {
      if (val) {
        this.explain({ groupId: val })
      }
    },
    userId (val) {
      if (val) {
        this.explain({ userId: val })
      }
    },
    userSearch: _.debounce(async function (val) {
      if (!val || val.length < 2) {
        return
      }
      this.userSearchLoading = true
      try {
        const resp = await this.$apollo.query({
          query: gql`query ($query: String!) { users { search(query: $query) { id name email } } }`,
          variables: { query: val },
          fetchPolicy: 'network-only'
        })
        this.users = _.get(resp, 'data.users.search', [])
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.userSearchLoading = false
    }, 300)
  },
  methods: {
    async explain (subject) {
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($pageId: Int!, $userId: Int, $groupId: Int) {
              pages {
                explainAccess(pageId: $pageId, userId: $userId, groupId: $groupId) {
                  permission allowed reason groupId groupName ruleMatch rulePath ruleDeny
                }
              }
            }
          `,
          variables: { pageId: this.pageId, ...subject },
          fetchPolicy: 'network-only'
        })
        this.results = _.get(resp, 'data.pages.explainAccess', [])
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    reasonLabel (row) {
      switch (row.reason) {
        case 'ADMIN':
          return this.$t('admin:pages.accessReasonAdmin', { defaultValue: 'Administrator (manage:system)' })
        case 'NO_GLOBAL':
          return this.$t('admin:pages.accessReasonNoGlobal', { defaultValue: 'Permission not granted to any of the groups' })
        case 'NO_RULE':
          return this.$t('admin:pages.accessReasonNoRule', { defaultValue: 'No page rule matches this page' })
        default:
          return `${row.groupName || '#' + row.groupId}: ${row.ruleDeny ? 'DENY' : 'ALLOW'} ${row.ruleMatch} ${row.ruleMatch === 'TAG' ? row.rulePath : '/' + row.rulePath}`
      }
    }
  },
  apollo: {
    groups: {
      query: groupsQuery,
      update: (data) => _.get(data, 'groups.list', [])
    }
  }
}
</script>
