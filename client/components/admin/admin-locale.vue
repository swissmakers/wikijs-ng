<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-globe-earth.svg', alt='Locale', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:locale.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:locale.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.ml-3(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(xl6 lg5 xs12)
              v-card.wiki-form.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.settings') }}
                v-card-text
                  v-select(
                    outlined
                    :items='locales'
                    prepend-icon='mdi-web'
                    v-model='selectedLocale'
                    item-value='code'
                    item-text='nativeName'
                    :label='namespacing ? $t("admin:locale.base.labelWithNS") : $t("admin:locale.base.label")'
                    persistent-hint
                    :hint='$t("admin:locale.base.hint")'
                  )
                    template(slot='item', slot-scope='data')
                      template(v-if='typeof data.item !== "object"')
                        v-list-item-content(v-text='data.item')
                      template(v-else)
                        v-list-item-avatar
                          v-avatar.blue.white--text(tile, size='40', v-html='data.item.code.toUpperCase()')
                        v-list-item-content
                          v-list-item-title(v-html='data.item.name')
                          v-list-item-subtitle(v-html='data.item.nativeName')

              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.namespacing') }}
                v-card-text
                  v-switch(
                    inset
                    v-model='namespacing'
                    :label='$t("admin:locale.namespaces.label")'
                    color='primary'
                    persistent-hint
                    :hint='$t("admin:locale.namespaces.hint")'
                    )
                  v-alert.mt-3(
                    outlined
                    color='orange'
                    :value='true'
                    icon='mdi-alert'
                    )
                    span {{ $t('admin:locale.namespacingPrefixWarning.title', { langCode: selectedLocale }) }}
                    .caption.grey--text {{ $t('admin:locale.namespacingPrefixWarning.subtitle') }}
                  v-divider.mt-3.mb-4
                  v-select(
                    outlined
                    :disabled='!namespacing'
                    :items='locales'
                    prepend-icon='mdi-web'
                    multiple
                    chips
                    deletable-chips
                    v-model='namespaces'
                    item-value='code'
                    item-text='name'
                    :label='$t("admin:locale.activeNamespaces.label")'
                    persistent-hint
                    small-chips
                    :hint='$t("admin:locale.activeNamespaces.hint")'
                    )
                    template(slot='item', slot-scope='data')
                      template(v-if='typeof data.item !== "object"')
                        v-list-item-content(v-text='data.item')
                      template(v-else)
                        v-list-item-avatar
                          v-avatar.blue.white--text(tile, size='40', v-html='data.item.code.toUpperCase()')
                        v-list-item-content
                          v-list-item-title(v-html='data.item.name')
                          v-list-item-subtitle(v-html='data.item.nativeName')
                        v-list-item-action
                          v-checkbox(:input-value='data.attrs.inputValue', color='primary', value)
            v-flex(xl6 lg7 xs12)
              v-card.animated.fadeInUp.wait-p4s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.availableTitle', { defaultValue: 'Available Languages' }) }}
                v-data-table(
                  :headers='headers',
                  :items='locales',
                  hide-default-footer,
                  item-key='code',
                  :items-per-page='1000'
                  )
                  template(v-slot:item.code='{ item }')
                    v-chip(label, color='primary', dark, small) {{item.code}}
                  template(v-slot:item.name='{ item }')
                    strong {{item.name}}
                  template(v-slot:item.isRTL='{ item }')
                    v-icon(v-if='item.isRTL') mdi-check
                  template(v-slot:item.source='{ item }')
                    span.caption {{ sourceLabel(item) }}
              v-card.wiki-form.mt-3.animated.fadeInUp.wait-p5s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:locale.sideload') }}
                v-card-text
                  .body-2 {{ $t('admin:locale.sideloadHelp') }}
                  v-text-field.mt-4(
                    outlined
                    readonly
                    hide-details
                    prepend-icon='mdi-folder-outline'
                    :label='$t(`admin:locale.sideloadFolder`, { defaultValue: `Sideload folder` })'
                    :value='sideloadPath'
                    )
</template>

<script>
import _ from 'lodash'

/* global WIKI */

import localesQuery from 'gql/admin/locale/locale-query-list.gql'
import localesSaveMutation from 'gql/admin/locale/locale-mutation-save.gql'

export default {
  data() {
    return {
      loading: false,
      locales: [],
      selectedLocale: 'en',
      namespacing: false,
      namespaces: [],
      sideloadPath: ''
    }
  },
  computed: {
    headers() {
      return [
        {
          text: this.$t('admin:locale.code'),
          align: 'left',
          value: 'code',
          width: 90
        },
        {
          text: this.$t('admin:locale.name'),
          align: 'left',
          value: 'name'
        },
        {
          text: this.$t('admin:locale.nativeName'),
          align: 'left',
          value: 'nativeName'
        },
        {
          text: this.$t('admin:locale.rtl'),
          align: 'center',
          value: 'isRTL',
          sortable: false,
          width: 10
        },
        {
          text: this.$t('admin:locale.source', { defaultValue: 'Source' }),
          align: 'left',
          value: 'source',
          sortable: false
        }
      ]
    }
  },
  methods: {
    sourceLabel(lc) {
      if (lc.isBundled) {
        return this.$t('admin:locale.sourceBundled', { defaultValue: 'Bundled' })
      } else if (lc.isSideloaded) {
        return this.$t('admin:locale.sourceSideloaded', { defaultValue: 'Sideloaded' })
      } else {
        return this.$t('admin:locale.sourceDatabase', { defaultValue: 'Database (legacy pack)' })
      }
    },
    async save() {
      this.loading = true
      const respRaw = await this.$apollo.mutate({
        mutation: localesSaveMutation,
        variables: {
          locale: this.selectedLocale,
          namespacing: this.namespacing,
          namespaces: this.namespaces
        }
      })
      const resp = _.get(respRaw, 'data.localization.updateLocale.responseResult', {})
      if (resp.succeeded) {
        // Change UI language
        WIKI.$i18n.i18next.changeLanguage(this.selectedLocale)
        WIKI.$datetime.setLocale(this.selectedLocale)

        // Check for RTL
        const curLocale = _.find(this.locales, ['code', this.selectedLocale])
        this.$vuetify.rtl = curLocale && curLocale.isRTL

        this.$store.commit('showNotification', {
          message: 'Locale settings updated successfully.',
          style: 'success',
          icon: 'check'
        })

        _.delay(() => {
          window.location.reload(true)
        }, 1000)
      } else {
        this.$store.commit('showNotification', {
          message: `Error: ${resp.message}`,
          style: 'error',
          icon: 'warning'
        })
      }
      this.loading = false
    }
  },
  apollo: {
    locales: {
      query: localesQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.localization.locales,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-locale-refresh')
      }
    },
    selectedLocale: {
      query: localesQuery,
      update: (data) => data.localization.config.locale
    },
    namespacing: {
      query: localesQuery,
      update: (data) => data.localization.config.namespacing
    },
    namespaces: {
      query: localesQuery,
      update: (data) => data.localization.config.namespaces
    },
    sideloadPath: {
      query: localesQuery,
      update: (data) => data.localization.config.sideloadPath
    }
  }
}
</script>
