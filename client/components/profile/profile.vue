<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-profile.svg', alt='Users', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('profile:title')}}
            .subtitle-1.grey--text.animated.fadeInLeft {{$t('profile:subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='saveProfile', :loading='saveLoading', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.save')}}
          //- v-btn.animated.fadeInDown(outlined, color='primary', disabled).mr-0
          //-   v-icon(left) mdi-earth
          //-   span {{$t('profile:viewPublicProfile')}}
      v-flex(lg6 xs12)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title.subtitle-1 {{$t('profile:myInfo')}}
          v-list(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account
              v-list-item-content
                v-list-item-title {{$t('profile:displayName')}}
                v-list-item-subtitle {{ user.name }}
              v-list-item-action
                v-menu(
                  v-model='editPop.name'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptDisplayName`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card
                    v-text-field(
                      ref='iptDisplayName'
                      v-model='user.name'
                      :label='$t(`profile:displayName`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.name = false'
                      @keydown.enter='editPop.name = false'
                      @keydown.esc='editPop.name = false'
                    )
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-marker
              v-list-item-content
                v-list-item-title {{$t('profile:location')}}
                v-list-item-subtitle {{ user.location }}
              v-list-item-action
                v-menu(
                  v-model='editPop.location'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptLocation`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card
                    v-text-field(
                      ref='iptLocation'
                      v-model='user.location'
                      :label='$t(`profile:location`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.location = false'
                      @keydown.enter='editPop.location = false'
                      @keydown.esc='editPop.location = false'
                    )
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-briefcase
              v-list-item-content
                v-list-item-title {{$t('profile:jobTitle')}}
                v-list-item-subtitle {{ user.jobTitle }}
              v-list-item-action
                v-menu(
                  v-model='editPop.jobTitle'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptJobTitle`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card
                    v-text-field(
                      ref='iptJobTitle'
                      v-model='user.jobTitle'
                      :label='$t(`profile:jobTitle`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.jobTitle = false'
                      @keydown.enter='editPop.jobTitle = false'
                      @keydown.esc='editPop.jobTitle = false'
                    )

        v-card.mt-3.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:auth.title')}}
          v-card-text.pt-0
            v-subheader.pl-0: span.subtitle-2 {{$t('profile:auth.provider')}}
            v-toolbar(
              flat
              :color='$vuetify.theme.dark ? "grey darken-2" : "grey lighten-4"'
              dense
              :class='$vuetify.theme.dark ? "grey--text text--lighten-1" : "primary--text"'
              )
              v-icon(:color='$vuetify.theme.dark ? "grey lighten-1" : "primary"') mdi-shield-lock
              .subheading.ml-3 {{ user.providerName }}
            template(v-if='user.tfaAvailable')
              v-divider.mt-3
              v-subheader.pl-0: span.subtitle-2 {{$t('profile:auth.tfa.title', { defaultValue: 'Two-Factor Authentication (2FA)' })}}
              .d-flex.align-center.mb-2
                v-chip.mr-3(small, label, :color='user.tfaIsActive ? `success` : `grey`', dark)
                  v-icon(left, small) {{ user.tfaIsActive ? 'mdi-shield-check' : 'mdi-shield-off-outline' }}
                  span {{ user.tfaIsActive ? $t('profile:auth.tfa.enabled', { defaultValue: 'Enabled' }) : $t('profile:auth.tfa.disabled', { defaultValue: 'Disabled' }) }}
                .caption {{ user.tfaEnforced ? $t('profile:auth.tfa.enforced', { defaultValue: '2FA is required for all users of this wiki.' }) : $t('profile:auth.tfa.hint', { defaultValue: 'Requires a code from an authenticator app on your phone when signing in.' }) }}
              template(v-if='!user.tfaIsActive && !tfaSetup.qrImage')
                v-text-field.mt-2(
                  v-if='user.providerKey === `local`'
                  v-model='tfaPassword'
                  outlined
                  dense
                  hide-details
                  type='password'
                  autocomplete='current-password'
                  prepend-inner-icon='mdi-form-textbox-password'
                  :label='$t(`profile:auth.currentPassword`)'
                  @keydown.enter='setupTFA'
                  )
                v-btn.mt-3.ml-0(color='primary', depressed, :loading='tfaLoading', @click='setupTFA')
                  v-icon(left) mdi-shield-key-outline
                  span {{$t('profile:auth.tfa.enable', { defaultValue: 'Enable 2FA' })}}
              template(v-else-if='!user.tfaIsActive')
                .body-2.mt-2 {{$t('profile:auth.tfa.scan', { defaultValue: 'Scan this QR code with your authenticator app, then enter the code it shows.' })}}
                .profile-tfa-qr.my-3(v-html='tfaSetup.qrImage')
                .caption {{$t('profile:auth.tfa.manualKey', { defaultValue: 'Or enter this key manually:' })}} #[code.profile-tfa-secret {{ tfaSetup.secret }}]
                v-text-field.mt-3(
                  v-model='tfaCode'
                  outlined
                  dense
                  hide-details
                  inputmode='numeric'
                  autocomplete='one-time-code'
                  maxlength='6'
                  prepend-inner-icon='mdi-numeric'
                  :label='$t(`profile:auth.tfa.code`, { defaultValue: `Security code` })'
                  @keydown.enter='confirmTFA'
                  )
                .d-flex.mt-3
                  v-btn(text, @click='cancelTFASetup') {{$t('common:actions.cancel')}}
                  v-spacer
                  v-btn(color='primary', depressed, :loading='tfaLoading', @click='confirmTFA')
                    v-icon(left) mdi-check
                    span {{$t('profile:auth.tfa.confirm', { defaultValue: 'Confirm and enable' })}}
              template(v-else-if='!user.tfaEnforced')
                v-text-field.mt-2(
                  v-model='tfaCode'
                  outlined
                  dense
                  hide-details
                  inputmode='numeric'
                  autocomplete='one-time-code'
                  maxlength='6'
                  prepend-inner-icon='mdi-numeric'
                  :label='$t(`profile:auth.tfa.code`, { defaultValue: `Security code` })'
                  @keydown.enter='disableTFA'
                  )
                v-btn.mt-3.ml-0(color='red darken-2', dark, depressed, :loading='tfaLoading', @click='disableTFA')
                  v-icon(left) mdi-shield-off-outline
                  span {{$t('profile:auth.tfa.disable', { defaultValue: 'Disable 2FA' })}}
            template(v-if='user.providerKey === `local`')
              form#change-password-form(@submit.prevent='changePassword')
                v-divider.mt-3
                v-subheader.pl-0: span.subtitle-2 {{$t('profile:auth.changePassword')}}
                v-text-field(
                  ref='iptCurrentPass'
                  v-model='currentPass'
                  outlined
                  :label='$t(`profile:auth.currentPassword`)'
                  type='password'
                  prepend-inner-icon='mdi-form-textbox-password'
                  autocomplete='current-password'
                  )
                v-text-field(
                  ref='iptNewPass'
                  v-model='newPass'
                  outlined
                  :label='$t(`profile:auth.newPassword`)'
                  type='password'
                  prepend-inner-icon='mdi-form-textbox-password'
                  autocomplete='off'
                  counter='255'
                  loading
                  )
                  password-strength(slot='progress', v-model='newPass')
                v-text-field(
                  ref='iptVerifyPass'
                  v-model='verifyPass'
                  outlined
                  :label='$t(`profile:auth.verifyPassword`)'
                  type='password'
                  prepend-inner-icon='mdi-form-textbox-password'
                  autocomplete='off'
                  hide-details
                  )
          v-card-chin(v-if='user.providerKey === `local`')
            v-spacer
            v-btn.px-4(color='primary', dark, depressed, :loading='changePassLoading', type='submit', form='change-password-form')
              v-icon(left) mdi-progress-check
              span {{$t('profile:auth.changePassword')}}
      v-flex(lg6 xs12)
        //- v-card
        //-   v-toolbar(color='blue-grey', dark, dense, flat)
        //-     v-toolbar-title
        //-       .subtitle-1 Picture
        //-   v-card-title
        //-     v-avatar.blue(v-if='picture.kind === `initials`', :size='40')
        //-       span.white--text.subheading {{picture.initials}}
        //-     v-avatar(v-else-if='picture.kind === `image`', :size='40')
        //-       v-img(:src='picture.url')
        //-     v-btn(outlined).mx-4 Upload Picture
        //-     v-btn(outlined, disabled) Remove Picture
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title.subtitle-1 {{$t('profile:preferences')}}
          v-list(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-clock-outline
              v-list-item-content
                v-list-item-title {{$t('profile:timezone')}}
                v-list-item-subtitle {{ user.timezone }}
              v-list-item-action
                v-menu(
                  v-model='editPop.timezone'
                  :close-on-content-click='false'
                  min-width='350'
                  max-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptTimezone`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card(flat)
                    v-select(
                      ref='iptTimezone'
                      :items='timezones'
                      v-model='user.timezone'
                      :label='$t(`profile:timezone`)'
                      solo
                      flat
                      dense
                      hide-details
                      @keydown.enter='editPop.timezone = false'
                      @keydown.esc='editPop.timezone = false'
                      style='height: 38px;'
                    )
                    v-card-chin
                      v-spacer
                      v-btn(
                        small
                        text
                        color='primary'
                        @click='editPop.timezone = false'
                        )
                        v-icon(left) mdi-check
                        span {{$t('common:actions.ok')}}
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-calendar-month-outline
              v-list-item-content
                v-list-item-title {{$t('profile:dateFormat')}}
                v-list-item-subtitle {{ user.dateFormat && user.dateFormat.length > 0 ? user.dateFormat : $t('profile:localeDefault') }}
              v-list-item-action
                v-menu(
                  v-model='editPop.dateFormat'
                  :close-on-content-click='false'
                  min-width='350'
                  max-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptDateFormat`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card(flat)
                    v-select(
                      ref='iptDateFormat'
                      :items='dateFormats'
                      v-model='user.dateFormat'
                      :label='$t(`profile:dateFormat`)'
                      solo
                      flat
                      dense
                      hide-details
                      @keydown.enter='editPop.dateFormat = false'
                      @keydown.esc='editPop.dateFormat = false'
                      style='height: 38px;'
                    )
                    v-card-chin
                      v-spacer
                      v-btn(
                        small
                        text
                        color='primary'
                        @click='editPop.dateFormat = false'
                        )
                        v-icon(left) mdi-check
                        span {{$t('common:actions.ok')}}
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-palette
              v-list-item-content
                v-list-item-title {{$t('profile:appearance')}}
                v-list-item-subtitle {{ currentAppearance }}
              v-list-item-action
                v-menu(
                  v-model='editPop.appearance'
                  :close-on-content-click='false'
                  min-width='350'
                  max-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptAppearance`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card(flat)
                    v-select(
                      ref='iptAppearance'
                      :items='appearances'
                      v-model='user.appearance'
                      :label='$t(`profile:appearance`)'
                      solo
                      flat
                      dense
                      hide-details
                      @keydown.enter='editPop.appearance = false'
                      @keydown.esc='editPop.appearance = false'
                      style='height: 38px;'
                    )
                    v-card-chin
                      v-spacer
                      v-btn(
                        small
                        text
                        color='primary'
                        @click='editPop.appearance = false'
                        )
                        v-icon(left) mdi-check
                        span {{$t('common:actions.ok')}}

        v-card.mt-3.animated.fadeInUp.wait-p3s
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:groups.title')}}
          v-list(dense)
            template(v-for='(grp, idx) of user.groups')
              v-list-item(:key='`grp-id-` + grp')
                v-list-item-avatar(size='32')
                  v-icon mdi-account-group
                v-list-item-content
                  v-list-item-title.body-2 {{grp}}
              v-divider(v-if='idx < user.groups.length - 1')

        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:activity.title')}}
          v-card-text.grey--text.text--darken-2
            .caption.grey--text {{$t('profile:activity.joinedOn')}}
            .body-2: strong {{ user.createdAt | date('LLLL') }}
            .caption.grey--text.mt-3 {{$t('profile:activity.lastUpdatedOn')}}
            .body-2: strong {{ user.updatedAt | date('LLLL') }}
            .caption.grey--text.mt-3 {{$t('profile:activity.lastLoginOn')}}
            .body-2: strong {{ user.lastLoginAt | date('LLLL') }}
            v-divider.mt-3
            .caption.grey--text.mt-3 {{$t('profile:activity.pagesCreated')}}
            .body-2: strong {{ user.pagesTotal }}
</template>

<script>
import gql from 'graphql-tag'
import _ from 'lodash'
import Cookies from 'js-cookie'
import validate from 'validate.js'

import PasswordStrength from '../common/password-strength.vue'
import { timezones } from '@/helpers'

/* global WIKI, siteConfig */

export default {
  i18nOptions: {
    namespaces: ['profile', 'auth']
  },
  components: {
    PasswordStrength
  },
  data() {
    return {
      saveLoading: false,
      changePassLoading: false,
      user: {
        name: 'unknown',
        location: '',
        jobTitle: '',
        timezone: '',
        dateFormat: '',
        appearance: '',
        createdAt: '1970-01-01',
        updatedAt: '1970-01-01',
        lastLoginAt: '1970-01-01',
        groups: []
      },
      currentPass: '',
      newPass: '',
      verifyPass: '',
      tfaLoading: false,
      tfaPassword: '',
      tfaCode: '',
      tfaSetup: {
        qrImage: '',
        secret: ''
      },
      editPop: {
        name: false,
        location: false,
        jobTitle: false,
        timezone: false,
        dateFormat: false,
        appearance: false
      },
      timezones: timezones()
    }
  },
  computed: {
    dateFormats () {
      return [
        { text: this.$t('profile:localeDefault'), value: '' },
        { text: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
        { text: 'DD.MM.YYYY', value: 'DD.MM.YYYY' },
        { text: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
        { text: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
        { text: 'YYYY/MM/DD', value: 'YYYY/MM/DD' }
      ]
    },
    appearances () {
      return [
        { text: this.$t('profile:appearanceDefault'), value: '' },
        { text: this.$t('profile:appearanceLight'), value: 'light' },
        { text: this.$t('profile:appearanceDark'), value: 'dark' }
      ]
    },
    currentAppearance () {
      return _.get(_.find(this.appearances, ['value', this.user.appearance]), 'text', false) || this.$t('profile:appearanceDefault')
    }
  },
  watch: {
    'user.appearance': (newValue, oldValue) => {
      if (newValue === '') {
        WIKI.$vuetify.theme.dark = siteConfig.darkMode
      } else {
        WIKI.$vuetify.theme.dark = (newValue === 'dark')
      }
    },
    'user.dateFormat': (newValue, oldValue) => {
      WIKI.$datetime.setDateFormat(newValue)
    },
    'user.timezone': (newValue, oldValue) => {
      WIKI.$datetime.setZone(newValue)
    }
  },
  methods: {
    /**
     * Run a 2FA mutation and show its result
     */
    async runTFAMutation (mutation, variables, resultPath) {
      this.tfaLoading = true
      let result = null
      try {
        const respRaw = await this.$apollo.mutate({ mutation, variables })
        result = _.get(respRaw, `data.users.${resultPath}`, {})
        const resp = _.get(result, 'responseResult', {})
        if (!resp.succeeded) {
          throw new Error(resp.message)
        }
        this.$store.commit('showNotification', {
          style: 'success',
          message: resp.message,
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
        result = null
      }
      this.tfaLoading = false
      return result
    },
    async setupTFA () {
      const result = await this.runTFAMutation(gql`
        mutation ($password: String) {
          users {
            setupTFA(password: $password) {
              responseResult { succeeded errorCode slug message }
              qrImage
              secret
            }
          }
        }
      `, { password: this.tfaPassword }, 'setupTFA')
      if (result) {
        this.tfaPassword = ''
        this.tfaCode = ''
        this.tfaSetup = { qrImage: result.qrImage, secret: result.secret }
      }
    },
    cancelTFASetup () {
      this.tfaSetup = { qrImage: '', secret: '' }
      this.tfaCode = ''
    },
    async confirmTFA () {
      const result = await this.runTFAMutation(gql`
        mutation ($securityCode: String!) {
          users {
            confirmTFA(securityCode: $securityCode) {
              responseResult { succeeded errorCode slug message }
            }
          }
        }
      `, { securityCode: _.trim(this.tfaCode) }, 'confirmTFA')
      if (result) {
        this.cancelTFASetup()
        this.user.tfaIsActive = true
      }
    },
    async disableTFA () {
      const result = await this.runTFAMutation(gql`
        mutation ($securityCode: String!) {
          users {
            disableOwnTFA(securityCode: $securityCode) {
              responseResult { succeeded errorCode slug message }
            }
          }
        }
      `, { securityCode: _.trim(this.tfaCode) }, 'disableOwnTFA')
      if (result) {
        this.tfaCode = ''
        this.user.tfaIsActive = false
      }
    },
    /**
     * Focus an input after delay
     */
    focusField (ipt) {
      this.$nextTick(() => {
        _.delay(() => {
          this.$refs[ipt].focus()
        }, 200)
      })
    },
    /**
     * Save User Profile
     */
    async saveProfile () {
      this.saveLoading = true
      this.$store.commit(`loadingStart`, 'profile-save')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: gql`
            mutation ($name: String!, $location: String!, $jobTitle: String!, $timezone: String!, $dateFormat: String!, $appearance: String!) {
              users {
                updateProfile(name: $name, location: $location, jobTitle: $jobTitle, timezone: $timezone, dateFormat: $dateFormat, appearance: $appearance) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  jwt
                }
              }
            }
          `,
          variables: {
            name: this.user.name,
            location: this.user.location,
            jobTitle: this.user.jobTitle,
            timezone: this.user.timezone,
            dateFormat: this.user.dateFormat,
            appearance: this.user.appearance
          }
        })
        const resp = _.get(respRaw, 'data.users.updateProfile.responseResult', {})
        if (resp.succeeded) {
          Cookies.set('jwt', _.get(respRaw, 'data.users.updateProfile.jwt', ''), { expires: 365, secure: window.location.protocol === 'https:' })
          this.$store.set('user/name', this.user.name)
          this.$store.commit('showNotification', {
            message: this.$t('profile:save.success'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'profile-save')
      this.saveLoading = false
    },
    /**
     * Change Password
     */
    async changePassword () {
      const validation = validate({
        current: this.currentPass,
        password: this.newPass,
        verifyPassword: this.verifyPass
      }, {
        current: {
          presence: {
            message: this.$t('auth:missingPassword'),
            allowEmpty: false
          },
          length: {
            minimum: 6,
            tooShort: this.$t('auth:passwordTooShort')
          }
        },
        password: {
          presence: {
            message: this.$t('auth:missingPassword'),
            allowEmpty: false
          },
          length: {
            minimum: 6,
            tooShort: this.$t('auth:passwordTooShort')
          }
        },
        verifyPassword: {
          equality: {
            attribute: 'password',
            message: this.$t('auth:passwordNotMatch')
          }
        }
      }, { fullMessages: false })

      if (validation) {
        if (validation.current) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.current[0],
            icon: 'warning'
          })
          this.$refs.iptCurrentPass.focus()
        } else if (validation.password) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.password[0],
            icon: 'warning'
          })
          this.$refs.iptNewPass.focus()
        } else if (validation.verifyPassword) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.verifyPassword[0],
            icon: 'warning'
          })
          this.$refs.iptVerifyPass.focus()
        }
      } else {
        this.changePassLoading = true
        this.$store.commit(`loadingStart`, 'profile-changepassword')

        try {
          const respRaw = await this.$apollo.mutate({
            mutation: gql`
              mutation ($current: String!, $new: String!) {
                users {
                  changePassword(current: $current, new: $new) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    jwt
                  }
                }
              }
            `,
            variables: {
              current: this.currentPass,
              new: this.newPass
            }
          })
          const resp = _.get(respRaw, 'data.users.changePassword.responseResult', {})
          if (resp.succeeded) {
            this.currentPass = ''
            this.newPass = ''
            this.verifyPass = ''
            Cookies.set('jwt', _.get(respRaw, 'data.users.changePassword.jwt', ''), { expires: 365, secure: window.location.protocol === 'https:' })
            this.$store.commit('showNotification', {
              message: this.$t('profile:auth.changePassSuccess'),
              style: 'success',
              icon: 'check'
            })
          } else {
            throw new Error(resp.message)
          }
        } catch (err) {
          this.$store.commit('pushGraphError', err)
        }

        this.$store.commit(`loadingStop`, 'profile-changepassword')
        this.changePassLoading = false
      }
    }
  },
  apollo: {
    user: {
      query: gql`
        {
          users {
            profile {
              id
              name
              email
              providerKey
              providerName
              isSystem
              isVerified
              location
              jobTitle
              timezone
              dateFormat
              appearance
              createdAt
              updatedAt
              lastLoginAt
              groups
              pagesTotal
              tfaIsActive
              tfaAvailable
              tfaEnforced
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.users.profile),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'profile-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.profile-tfa-qr {
  width: 200px;
  height: 200px;
  padding: 8px;
  background-color: #FFF;
  border-radius: 4px;

  svg {
    width: 100%;
    height: 100%;
  }
}

.profile-tfa-secret {
  word-break: break-all;
}
</style>
