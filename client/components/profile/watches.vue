<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-news.svg', alt='Watches', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('profile:watches.title', { defaultValue: 'Watched Pages' }) }}
            .subtitle-1.grey--text.animated.fadeInLeft {{ $t('profile:watches.subtitle', { defaultValue: 'Get an e-mail digest when these pages change' }) }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p1s(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
      v-flex(xs12)
        v-alert(v-if='!notificationsEnabled', type='info', outlined, dense) {{ $t('profile:watches.disabled', { defaultValue: 'E-mail notifications are currently not available on this wiki.' }) }}
        v-card.animated.fadeInUp
          v-toolbar(flat, :color='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-4`', dense)
            v-select.mr-3(
              v-if='locales.length > 1'
              v-model='newLocale'
              :items='locales'
              item-text='name'
              item-value='code'
              dense
              solo
              flat
              hide-details
              style='max-width: 160px;'
              )
            v-text-field(
              v-model='newPath'
              :label='$t(`profile:watches.addFolder`, { defaultValue: `Watch a folder (e.g. docs/setup)` })'
              prepend-inner-icon='mdi-folder-outline'
              hide-details
              dense
              solo
              flat
              :background-color='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-4`'
              @keydown.enter='addPathWatch'
              )
            v-btn(color='primary', depressed, :disabled='!newPath', :loading='loading', @click='addPathWatch')
              v-icon(left) mdi-bell-plus-outline
              span {{ $t('profile:watches.add', { defaultValue: 'Watch' }) }}
          v-divider
          v-list(two-line)
            template(v-for='(watch, idx) of watches')
              v-divider(v-if='idx > 0', :key='`div-` + watch.id')
              v-list-item(:key='`watch-` + watch.id', :href='watch.kind === `page` && watch.title !== null ? pagePath(watch.locale, watch.path) : null')
                v-list-item-avatar
                  v-icon(color='primary') {{ watch.kind === 'page' ? 'mdi-file-document-outline' : 'mdi-file-tree-outline' }}
                v-list-item-content
                  v-list-item-title {{ watch.kind === 'page' ? (watch.title || $t('profile:watches.deletedPage', { defaultValue: 'Deleted page' })) : `/${watch.path}` }}
                  v-list-item-subtitle {{ watch.kind === 'page' ? `/${watch.locale}/${watch.path}` : $t('profile:watches.folderHint', { defaultValue: 'This folder and all its pages' }) }}
                v-list-item-action
                  v-btn(icon, @click.prevent='removeWatch(watch)', :aria-label='$t(`common:page.stopWatching`, { defaultValue: `Stop watching` })')
                    v-icon(color='red darken-2') mdi-bell-off-outline
            v-alert.ma-3(v-if='watches.length < 1', icon='mdi-bell-outline', outlined, color='grey')
              em.caption {{ $t('profile:watches.empty', { defaultValue: 'You are not watching any page yet. Use the bell on a page to watch it.' }) }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { pagePath } from '@/helpers'

/* global siteConfig, siteLangs */

export default {
  data () {
    return {
      watches: [],
      loading: false,
      newPath: '',
      newLocale: siteConfig.lang,
      locales: siteLangs || []
    }
  },
  computed: {
    notificationsEnabled () {
      return siteConfig.notifications === true
    }
  },
  methods: {
    pagePath,
    async refresh () {
      await this.$apollo.queries.watches.refetch()
    },
    async run (mutation, variables, path) {
      this.loading = true
      try {
        const resp = await this.$apollo.mutate({ mutation, variables })
        const result = _.get(resp, path, {})
        if (!result.succeeded) {
          throw new Error(result.message)
        }
        await this.refresh()
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.loading = false
    },
    async addPathWatch () {
      if (!this.newPath) {
        return
      }
      await this.run(gql`
        mutation ($locale: String!, $path: String!) {
          watches { watchPath(locale: $locale, path: $path) { responseResult { succeeded message } } }
        }
      `, { locale: this.newLocale, path: this.newPath }, 'data.watches.watchPath.responseResult')
      this.newPath = ''
    },
    async removeWatch (watch) {
      await this.run(gql`
        mutation ($id: Int!) {
          watches { remove(id: $id) { responseResult { succeeded message } } }
        }
      `, { id: watch.id }, 'data.watches.remove.responseResult')
    }
  },
  apollo: {
    watches: {
      query: gql`
        {
          watches {
            list { id kind pageId locale path title createdAt }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.get(data, 'watches.list', []),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'profile-watches-refresh')
      }
    }
  }
}
</script>
