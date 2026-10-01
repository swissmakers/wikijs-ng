<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-paint-palette.svg', alt='Theme', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:theme.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{$t('admin:theme.subtitle')}}
          v-spacer
          v-btn.animated.fadeInRight(color='success', depressed, @click='save', large, :loading='loading')
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t('admin:theme.title')}}
                v-card-text
                  v-select(
                    :items='iconsets'
                    outlined
                    prepend-icon='mdi-paw'
                    v-model='config.iconset'
                    :label='$t(`admin:theme.iconset`)'
                    persistent-hint
                    :hint='$t(`admin:theme.iconsetHint`)'
                    )
                  v-divider.mt-3
                  v-switch(
                    inset
                    v-model='darkMode'
                    :label='$t(`admin:theme.darkMode`)'
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.darkModeHint`)'
                    )

              v-card.mt-3.animated.fadeInUp.wait-p1s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t(`admin:theme.options`)}}
                v-card-text
                  v-select(
                    :items='tocPositions'
                    outlined
                    prepend-icon='mdi-border-vertical'
                    v-model='config.tocPosition'
                    label='Table of Contents Position'
                    persistent-hint
                    hint='Select whether the table of contents is shown on the left, right or not at all.'
                    )
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t(`admin:theme.codeInjection`)}}
                v-card-text
                  v-textarea.is-monospaced(
                    v-model='config.injectCSS'
                    :label='$t(`admin:theme.cssOverride`)'
                    outlined
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.cssOverrideHint`)'
                    auto-grow
                    )
                  i18next.caption.pl-2.ml-1(path='admin:theme.cssOverrideWarning', tag='div')
                    strong.red--text(place='caution') {{$t('admin:theme.cssOverrideWarningCaution')}}
                    code(place='cssClass') .contents
                  v-textarea.is-monospaced.mt-3(
                    v-model='config.injectHead'
                    :label='$t(`admin:theme.headHtmlInjection`)'
                    outlined
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.headHtmlInjectionHint`)'
                    auto-grow
                    )
                  v-textarea.is-monospaced.mt-2(
                    v-model='config.injectBody'
                    :label='$t(`admin:theme.bodyHtmlInjection`)'
                    outlined
                    color='primary'
                    persistent-hint
                    :hint='$t(`admin:theme.bodyHtmlInjectionHint`)'
                    auto-grow
                    )
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'
import { applyAppearance } from '@/helpers/appearance'

import themeConfigQuery from 'gql/admin/theme/theme-query-config.gql'
import themeSaveMutation from 'gql/admin/theme/theme-mutation-save.gql'

/* global siteConfig */

export default {
  data() {
    return {
      loading: false,
      iconsets: [
        { text: 'Material Design Icons (default)', value: 'mdi' },
        { text: 'Font Awesome 5', value: 'fa' },
        { text: 'Font Awesome 4', value: 'fa4' }
      ],
      config: {
        theme: 'default',
        darkMode: false,
        iconset: '',
        tocPosition: 'left',
        injectCSS: '',
        injectHead: '',
        injectBody: ''
      },
      darkModeInitial: false
    }
  },
  computed: {
    darkMode: sync('site/dark'),
    tocPositions () {
      return [
        { text: 'Left (default)', value: 'left' },
        { text: 'Right', value: 'right' },
        { text: 'Hidden', value: 'off' }
      ]
    }
  },
  watch: {
    'darkMode' (newValue, oldValue) {
      this.$vuetify.theme.dark = newValue
    }
  },
  mounted() {
    this.darkModeInitial = this.darkMode
  },
  beforeDestroy() {
    // Restore the saved site-level setting in the store, but apply the user's
    // effective appearance to the UI (personal preference wins over site default)
    this.darkMode = this.darkModeInitial
    applyAppearance(this.$store.get('user/appearance'))
  },
  methods: {
    async save () {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-theme-save')
      try {
        const respRaw = await this.$apollo.mutate({
          mutation: themeSaveMutation,
          variables: {
            theme: this.config.theme,
            iconset: this.config.iconset,
            darkMode: this.darkMode,
            tocPosition: this.config.tocPosition,
            injectCSS: this.config.injectCSS,
            injectHead: this.config.injectHead,
            injectBody: this.config.injectBody
          }
        })
        const resp = _.get(respRaw, 'data.theming.setConfig.responseResult', {})
        if (resp.succeeded) {
          this.darkModeInitial = this.darkMode
          siteConfig.darkMode = this.darkMode
          this.$store.commit('showNotification', {
            message: 'Theme settings updated successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-theme-save')
      this.loading = false
    }
  },
  apollo: {
    config: {
      query: themeConfigQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.theming.config,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-theme-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.v-textarea.is-monospaced textarea {
  font-family: 'Roboto Mono', 'Courier New', Courier, monospace;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
</style>
