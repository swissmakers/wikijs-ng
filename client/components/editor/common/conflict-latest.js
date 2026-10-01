import _ from 'lodash'

import conflictLatestQuery from 'gql/editor/editor-query-conflict-latest.gql'

/**
 * Loads the latest saved version of the page for the conflict resolution dialogs
 */
export default {
  data () {
    return {
      latest: {
        title: '',
        description: '',
        updatedAt: '',
        authorName: '',
        content: '',
        locale: '',
        path: ''
      },
      isRemoteConfirmDiagShown: false
    }
  },
  methods: {
    async fetchLatest () {
      const resp = await this.$apollo.query({
        query: conflictLatestQuery,
        fetchPolicy: 'network-only',
        variables: {
          id: this.$store.get('page/id')
        }
      })
      const latest = _.get(resp, 'data.pages.conflictLatest', false)
      if (!latest) {
        this.$store.commit('showNotification', {
          message: 'Failed to fetch latest version.',
          style: 'warning',
          icon: 'warning'
        })
        return false
      }
      this.latest = latest
      return latest
    }
  }
}
