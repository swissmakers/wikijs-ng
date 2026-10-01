<template lang='pug'>
  v-app-bar.nav-header(color='header', dark, app, :clipped-left='!$vuetify.rtl', :clipped-right='$vuetify.rtl', fixed, flat, :extended='searchIsShown && $vuetify.breakpoint.smAndDown')
    v-toolbar(color='primary', flat, slot='extension', v-if='searchIsShown && $vuetify.breakpoint.smAndDown')
      v-text-field(
        ref='searchFieldMobile'
        v-model='search'
        clearable
        background-color='primary'
        color='white'
        :label='$t(`common:header.search`)'
        single-line
        solo
        flat
        hide-details
        prepend-inner-icon='mdi-magnify'
        :loading='searchIsLoading'
        @keyup.enter='searchEnter'
        autocomplete='off'
      )
    v-layout(row)
      v-flex(xs5, md4)
        v-toolbar.nav-header-inner(color='header', dark, flat, :class='$vuetify.rtl ? `pr-3` : `pl-3`')
          v-avatar(tile, size='34', @click='goHome')
            v-img.org-logo(:src='headerLogoUrl')
          v-toolbar-title(:class='{ "mx-3": $vuetify.breakpoint.mdAndUp, "mx-1": $vuetify.breakpoint.smAndDown }')
            span.subheading {{title}}
      v-flex(md4, v-if='$vuetify.breakpoint.mdAndUp')
        v-toolbar.nav-header-inner(color='header', dark, flat)
          slot(name='mid')
            transition(name='navHeaderSearch', v-if='searchIsShown')
              v-text-field(
                ref='searchField',
                v-if='searchIsShown && $vuetify.breakpoint.mdAndUp',
                v-model='search',
                color='white',
                :label='$t(`common:header.search`)',
                single-line,
                solo
                flat
                rounded
                hide-details,
                prepend-inner-icon='mdi-magnify',
                :loading='searchIsLoading',
                @keyup.enter='searchEnter'
                @keyup.esc='searchClose'
                @focus='searchFocus'
                @blur='searchBlur'
                @keyup.down='searchMove(`down`)'
                @keyup.up='searchMove(`up`)'
                autocomplete='off'
              )
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.ml-2.mr-0(icon, v-on='on', href='/t', :aria-label='$t(`common:header.browseTags`)')
                  v-icon(color='grey') mdi-tag-multiple
              span {{$t('common:header.browseTags')}}
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn.ml-0.mr-0(icon, v-on='on', href='/r', :aria-label='$t(`common:header.recentChanges`, { defaultValue: "Recent changes" })')
                  v-icon(color='grey') mdi-update
              span {{$t('common:header.recentChanges', { defaultValue: 'Recent changes' })}}
            v-tooltip(bottom, v-if='canManageAssets')
              template(v-slot:activator='{ on }')
                v-btn.ml-0.mr-0(icon, v-on='on', href='/a/assets', :aria-label='$t(`common:header.imagesFiles`)')
                  v-icon(color='grey') mdi-folder-multiple-image
              span {{$t('common:header.imagesFiles')}}
      v-flex(xs7, md4)
        v-toolbar.nav-header-inner.pr-4(color='header', dark, flat)
          v-spacer
          .navHeaderLoading.mr-3
            v-progress-circular(indeterminate, color='blue', :size='22', :width='2' v-show='isLoading')

          slot(name='actions')

          //- (mobile) SEARCH TOGGLE

          v-btn(
            v-if='!hideSearch && $vuetify.breakpoint.smAndDown'
            @click='searchToggle'
            icon
            )
            v-icon(color='grey') mdi-magnify

          //- LANGUAGES

          template(v-if='mode === `view` && locales.length > 0')
            v-menu(offset-y, bottom, transition='slide-y-transition', max-height='320px', min-width='210px', left)
              template(v-slot:activator='{ on: menu, attrs }')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on: tooltip }')
                    v-btn(
                      icon
                      v-bind='attrs'
                      v-on='{ ...menu, ...tooltip }'
                      :class='$vuetify.rtl ? `ml-3` : ``'
                      tile
                      height='64'
                      :aria-label='$t(`common:header.language`)'
                      )
                      v-icon(color='grey') mdi-web
                  span {{$t('common:header.language')}}
              v-list(nav)
                template(v-for='(lc, idx) of locales')
                  v-list-item(@click='changeLocale(lc)')
                    v-list-item-action(style='min-width:auto;'): v-chip(:color='lc.code === locale ? `primary` : `grey`', small, label, dark) {{lc.code.toUpperCase()}}
                    v-list-item-title {{lc.name}}
            v-divider(vertical)

          //- PAGE ACTIONS

          template(v-if='hasAnyPagePermissions && path && mode !== `edit`')
            v-menu(offset-y, bottom, transition='slide-y-transition', left)
              template(v-slot:activator='{ on: menu, attrs }')
                v-tooltip(bottom)
                  template(v-slot:activator='{ on: tooltip }')
                    v-btn(
                      icon
                      v-bind='attrs'
                      v-on='{ ...menu, ...tooltip }'
                      :class='$vuetify.rtl ? `ml-3` : ``'
                      tile
                      height='64'
                      :aria-label='$t(`common:header.pageActions`)'
                      )
                      v-icon(color='grey') mdi-file-document-edit-outline
                  span {{$t('common:header.pageActions')}}
              v-list(nav, :light='!$vuetify.theme.dark', :dark='$vuetify.theme.dark', :class='$vuetify.theme.dark ? `grey darken-4` : ``')
                .overline.pa-4.grey--text {{$t('common:header.currentPage')}}
                v-list-item.pl-4(@click='pageView', v-if='mode !== `view`')
                  v-list-item-avatar(size='24', tile): v-icon(color='primary') mdi-file-document-outline
                  v-list-item-title.body-2 {{$t('common:header.view')}}
                v-list-item.pl-4(@click='pageEdit', v-if='mode !== `edit` && hasWritePagesPermission')
                  v-list-item-avatar(size='24', tile): v-icon(color='primary') mdi-file-document-edit-outline
                  v-list-item-title.body-2 {{$t('common:header.edit')}}
                v-list-item.pl-4(v-for='action of pageActions', :key='action.key', @click='runPageAction(action.key)')
                  v-list-item-avatar(size='24', tile): v-icon(:color='action.isDanger ? `red darken-2` : `primary`') {{ action.icon }}
                  v-list-item-title.body-2 {{ action.label }}
            v-divider(vertical)

          //- NEW PAGE

          template(v-if='hasNewPagePermission && path && mode !== `edit`')
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn(icon, tile, height='64', v-on='on', @click='pageNew', :aria-label='$t(`common:header.newPage`)')
                  v-icon(color='grey') mdi-text-box-plus-outline
              span {{$t('common:header.newPage')}}
            v-divider(vertical)

          //- ADMIN

          template(v-if='isAuthenticated && isAdmin')
            v-tooltip(bottom, v-if='mode !== `admin`')
              template(v-slot:activator='{ on }')
                v-btn(icon, tile, height='64', v-on='on', href='/a', :aria-label='$t(`common:header.admin`)')
                  v-icon(color='grey') mdi-cog
              span {{$t('common:header.admin')}}
            v-btn(v-else, text, tile, height='64', href='/', :aria-label='$t(`common:actions.exit`)')
              v-icon(left, color='grey') mdi-exit-to-app
              span {{$t('common:actions.exit')}}
            v-divider(vertical)

          //- ACCOUNT

          v-menu(v-if='isAuthenticated', offset-y, bottom, min-width='300', transition='slide-y-transition', left)
            template(v-slot:activator='{ on: menu, attrs }')
              v-tooltip(bottom)
                template(v-slot:activator='{ on: tooltip }')
                  v-btn(
                    icon
                    v-bind='attrs'
                    v-on='{ ...menu, ...tooltip }'
                    :class='$vuetify.rtl ? `ml-0` : ``'
                    tile
                    height='64'
                    :aria-label='$t(`common:header.account`)'
                    )
                    v-icon(v-if='picture.kind === `initials`', color='grey') mdi-account-circle
                    v-avatar(v-else-if='picture.kind === `image`', :size='34')
                      v-img(:src='picture.url')
                span {{$t('common:header.account')}}
            v-list(nav)
              v-list-item.py-3.grey(:class='$vuetify.theme.dark ? `darken-4-l5` : `lighten-5`')
                v-list-item-avatar
                  v-avatar.primary(v-if='picture.kind === `initials`', :size='40')
                    span.white--text.subheading {{picture.initials}}
                  v-avatar(v-else-if='picture.kind === `image`', :size='40')
                    v-img(:src='picture.url')
                v-list-item-content
                  v-list-item-title {{name}}
                  v-list-item-subtitle {{email}}
              v-list-item(href='/p')
                v-list-item-action: v-icon(color='blue-grey') mdi-face-profile
                v-list-item-content
                  v-list-item-title(:class='$vuetify.theme.dark ? `blue-grey--text text--lighten-3` : `blue-grey--text`') {{$t('common:header.profile')}}
              v-list-item(@click='logout')
                v-list-item-action: v-icon(color='red') mdi-logout
                v-list-item-title.red--text {{$t('common:header.logout')}}

          template(v-else)
            v-tooltip(bottom)
              template(v-slot:activator='{ on }')
                v-btn(icon, tile, height='64', v-on='on', @click='cycleGuestAppearance', :aria-label='guestAppearanceLabel')
                  v-icon(color='grey') {{ guestAppearanceIcon }}
              span {{ guestAppearanceLabel }}
            v-tooltip(left)
              template(v-slot:activator='{ on }')
                v-btn(icon, v-on='on', color='grey darken-3', href='/login', :aria-label='$t(`common:header.login`)')
                  v-icon(color='grey') mdi-account-circle
              span {{$t('common:header.login')}}

    page-selector(mode='create', v-model='newPageModal', :open-handler='pageNewCreate', :locale='locale')
    shortcuts-dialog(v-model='shortcutsDialogShown')
    page-selector(mode='move', v-model='movePageModal', :open-handler='pageMoveRename', :path='path', :locale='locale')
    page-selector(mode='create', v-model='duplicateOpts.modal', :open-handler='pageDuplicateHandle', :path='duplicateOpts.path', :locale='duplicateOpts.locale')
    page-delete(v-model='deletePageModal', v-if='path && path.length')
    page-convert(v-model='convertPageModal', v-if='path && path.length')

    .nav-header-dev(v-if='isDevMode')
      v-icon mdi-alert
      div
        .overline DEVELOPMENT VERSION
        .overline This code base is NOT for production use!
</template>

<script>
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'

import movePageMutation from 'gql/common/common-pages-mutation-move.gql'
import pageActionsMixin from '@/helpers/page-actions'
import { installHotkeys } from '@/helpers/hotkeys'
import { initials } from '@/helpers'
import { applyAppearance, getGuestAppearance, setGuestAppearance } from '@/helpers/appearance'

/* global siteConfig, siteLangs */

export default {
  mixins: [pageActionsMixin],
  components: {
    ShortcutsDialog: () => import('./shortcuts-dialog.vue'),
    PageDelete: () => import('./page-delete.vue'),
    PageConvert: () => import('./page-convert.vue')
  },
  props: {
    dense: {
      type: Boolean,
      default: false
    },
    hideSearch: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      menuIsShown: true,
      searchIsShown: true,
      searchAdvMenuShown: false,
      newPageModal: false,
      shortcutsDialogShown: false,
      guestAppearance: getGuestAppearance(),
      movePageModal: false,
      convertPageModal: false,
      deletePageModal: false,
      locales: siteLangs,
      isDevMode: false,
      duplicateOpts: {
        locale: 'en',
        path: 'new-page',
        modal: false
      }
    }
  },
  computed: {
    search: sync('site/search'),
    searchIsFocused: sync('site/searchIsFocused'),
    searchIsLoading: sync('site/searchIsLoading'),
    searchRestrictLocale: sync('site/searchRestrictLocale'),
    searchRestrictPath: sync('site/searchRestrictPath'),
    isLoading: get('isLoading'),
    title: get('site/title'),
    logoUrl: get('site/logoUrl'),
    headerLogoUrl () {
      // -> The bundled logo is brand blue; use its white variant on the navy header
      return this.logoUrl === '/_assets/svg/logo-swissmakers.svg' ? '/_assets/svg/logo-swissmakers-white.svg' : this.logoUrl
    },
    path: get('page/path'),
    locale: get('page/locale'),
    mode: get('page/mode'),
    name: get('user/name'),
    email: get('user/email'),
    pictureUrl: get('user/pictureUrl'),
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    guestAppearanceIcon () {
      switch (this.guestAppearance) {
        case 'system':
          return 'mdi-theme-light-dark'
        case 'dark':
          return 'mdi-weather-night'
        case 'light':
          return 'mdi-weather-sunny'
        default:
          return this.$vuetify.theme.dark ? 'mdi-weather-night' : 'mdi-weather-sunny'
      }
    },
    guestAppearanceLabel () {
      const modes = {
        light: this.$t('common:header.appearanceLight', { defaultValue: 'Light' }),
        dark: this.$t('common:header.appearanceDark', { defaultValue: 'Dark' }),
        system: this.$t('common:header.appearanceSystem', { defaultValue: 'Follow System' })
      }
      const mode = modes[this.guestAppearance] || modes[this.$vuetify.theme.dark ? 'dark' : 'light']
      return `${this.$t('common:header.appearance', { defaultValue: 'Appearance' })}: ${mode}`
    },
    picture () {
      if (this.pictureUrl && this.pictureUrl.length > 1) {
        return {
          kind: 'image',
          url: (this.pictureUrl === 'internal') ? `/_userav/${this.$store.get('user/id')}` : this.pictureUrl
        }
      } else {
        return {
          kind: 'initials',
          initials: initials(this.name)
        }
      }
    },
    isAdmin () {
      return _.intersection(this.permissions, ['manage:system', 'write:users', 'manage:users', 'write:groups', 'manage:groups', 'manage:navigation', 'manage:theme', 'manage:api']).length > 0
    },
    canManageAssets () {
      return _.intersection(this.permissions, ['manage:system', 'write:assets', 'manage:assets']).length > 0
    },
    hasNewPagePermission () {
      return this.hasAdminPermission || _.intersection(this.permissions, ['write:pages']).length > 0
    }
  },
  created () {
    if (this.hideSearch || this.dense || this.$vuetify.breakpoint.smAndDown) {
      this.searchIsShown = false
    }
  },
  mounted () {
    this.$root.$on('pageEdit', () => {
      this.pageEdit()
    })
    this.$root.$on('pageHistory', () => {
      this.pageHistory()
    })
    this.$root.$on('pageSource', () => {
      this.pageSource()
    })
    this.$root.$on('pageMove', () => {
      this.pageMove()
    })
    this.$root.$on('pageConvert', () => {
      this.pageConvert()
    })
    this.$root.$on('pageDuplicate', () => {
      this.pageDuplicate()
    })
    this.$root.$on('pageDelete', () => {
      this.pageDelete()
    })
    this.isDevMode = siteConfig.devMode === true

    // -> Keyboard shortcuts (not while editing)
    this.$root.$on('shortcutSearch', () => {
      const field = this.$refs.searchField || this.$refs.searchFieldMobile
      if (field) {
        this.searchIsShown = true
        this.$nextTick(() => field.focus())
      }
    })
    this.$root.$on('shortcutEdit', () => {
      if (this.path && this.mode === 'view' && this.hasWritePagesPermission) {
        this.pageEdit()
      }
    })
    this.$root.$on('shortcutHistory', () => {
      if (this.path && this.mode === 'view' && this.hasReadHistoryPermission) {
        this.pageHistory()
      }
    })
    this.$root.$on('shortcutNewPage', () => {
      if (this.hasNewPagePermission) {
        this.pageNew()
      }
    })
    this.$root.$on('shortcutHelp', () => {
      this.shortcutsDialogShown = true
    })
    this.uninstallHotkeys = installHotkeys(this.$root, () => this.mode !== 'edit')
  },
  beforeDestroy () {
    if (this.uninstallHotkeys) {
      this.uninstallHotkeys()
    }
  },
  methods: {
    cycleGuestAppearance () {
      const order = ['light', 'dark', 'system']
      const next = this.guestAppearance
        ? order[(order.indexOf(this.guestAppearance) + 1) % order.length]
        : (this.$vuetify.theme.dark ? 'light' : 'dark')
      this.guestAppearance = next
      setGuestAppearance(next)
      applyAppearance(next)
    },
    searchFocus () {
      this.searchIsFocused = true
    },
    searchBlur () {
      this.searchIsFocused = false
    },
    searchClose () {
      this.search = ''
      this.searchBlur()
    },
    searchToggle () {
      this.searchIsShown = !this.searchIsShown
      if (this.searchIsShown) {
        _.delay(() => {
          this.$refs.searchFieldMobile.focus()
        }, 200)
      }
    },
    searchEnter () {
      this.$root.$emit('searchEnter', true)
    },
    searchMove (dir) {
      this.$root.$emit('searchMove', dir)
    },
    pageNew () {
      this.newPageModal = true
    },
    pageNewCreate ({ path, locale }) {
      window.location.assign(`/e/${locale}/${path}`)
    },
    runPageAction (key) {
      this[key]()
    },
    pageExportPdf () {
      // -> Handled by the page view
      this.$root.$emit('pageExportPdf')
    },
    pageView () {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    pageEdit () {
      window.location.assign(`/e/${this.locale}/${this.path}`)
    },
    pageHistory () {
      window.location.assign(`/h/${this.locale}/${this.path}`)
    },
    pageSource () {
      window.location.assign(`/s/${this.locale}/${this.path}`)
    },
    pageDuplicate () {
      const pathParts = this.path.split('/')
      this.duplicateOpts = {
        locale: this.locale,
        path: (pathParts.length > 1) ? _.initial(pathParts).join('/') + '/new-page' : 'new-page',
        modal: true
      }
    },
    pageDuplicateHandle ({ locale, path }) {
      window.location.assign(`/e/${locale}/${path}?from=${this.$store.get('page/id')}`)
    },
    pageConvert () {
      this.convertPageModal = true
    },
    pageMove () {
      this.movePageModal = true
    },
    async pageMoveRename ({ path, locale }) {
      this.$store.commit('loadingStart', 'page-move')
      try {
        const resp = await this.$apollo.mutate({
          mutation: movePageMutation,
          variables: {
            id: this.$store.get('page/id'),
            destinationLocale: locale,
            destinationPath: path
          }
        })
        if (_.get(resp, 'data.pages.move.responseResult.succeeded', false)) {
          window.location.replace(`/${locale}/${path}`)
        } else {
          throw new Error(_.get(resp, 'data.pages.move.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        this.$store.commit('loadingStop', 'page-move')
      }
    },
    pageDelete () {
      this.deletePageModal = true
    },
    async changeLocale (locale) {
      await this.$i18n.i18next.changeLanguage(locale.code)
      switch (this.mode) {
        case 'view':
        case 'history':
          window.location.assign(`/${locale.code}/${this.path}`)
          break
      }
    },
    logout () {
      window.location.assign('/logout')
    },
    goHome () {
      if (this.locales && this.locales.length > 0) {
        window.location.assign(`/${this.locale}/home`)
      } else {
        window.location.assign('/')
      }
    }
  }
}
</script>

<style lang='scss'>

.nav-header {
  //z-index: 1000;

  .v-toolbar__extension {
    padding: 0;

    .v-toolbar__content {
      padding: 0;
    }
    .v-text-field .v-input__prepend-inner {
      padding: 0 14px 0 5px;
      padding-right: 14px;
    }
  }

  .org-logo {
    cursor: pointer;
  }

  &-inner {
    .v-toolbar__content {
      padding: 0;
    }
  }

  &-search-adv {
    position: absolute;
    top: 7px;
    right: 12px;
    border-radius: 4px !important;

    @at-root .v-application--is-rtl & {
      right: initial;
      left: 12px;
    }

    &::before {
      border-radius: 4px !important;
    }

    &:hover, &:focus {
      position: absolute !important;

      &::before {
        border-radius: 4px;
      }
    }
  }

  &-dev {
    background-color: mc('red', '600');
    position: absolute;
    top: 11px;
    left: 255px;
    padding: 5px 15px;
    border-radius: 5px;
    display: flex;

    .v-icon {
      margin-right: 15px;
    }

    .overline:nth-child(2) {
      text-transform: none;
    }
  }
}

.navHeaderSearch {
  &-enter-active, &-leave-active {
    transition: opacity .25s ease, transform .25s ease;
    opacity: 1;
  }
  &-enter-active {
    transition-delay: .25s;
  }
  &-enter, &-leave-to {
    opacity: 0;
    transform: scale(.7, .7);
  }
}
.navHeaderLoading { // To avoid search bar jumping
  width: 22px;
}

</style>
