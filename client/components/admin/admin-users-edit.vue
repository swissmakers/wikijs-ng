<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-male-user.svg', :alt='$t(`admin:users.edit`)', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft {{$t('admin:users.edit')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{user.name}}
          v-spacer
          i18next.pr-4.caption.grey--text.animated.fadeInDown(path='admin:users.id', tag='div')
            strong(place='id') {{user.id}}
          template(v-if='user.isActive')
            status-indicator.mr-3(positive, pulse)
            .caption.green--text {{$t('admin:users.active')}}
          template(v-else)
            status-indicator.mr-3(negative, pulse)
            .caption.red--text {{$t('admin:users.inactive')}}
          template(v-if='user.isVerified')
            status-indicator.mr-3.ml-4(active, pulse)
            .caption.blue--text {{$t('admin:users.verified')}}
          template(v-else)
            status-indicator.mr-3.ml-4(intermediary, pulse)
            .caption.deep-orange--text {{$t('admin:users.unverified')}}
          v-spacer
          v-btn.ml-3.animated.fadeInDown.wait-p3s(color='grey', icon, outlined, to='/users')
            v-icon mdi-arrow-left
          v-menu(offset-y, origin='top right')
            template(v-slot:activator='{ on }')
              v-btn.ml-3.animated.fadeInDown.wait-p2s(color='black', v-on='on', depressed, dark)
                span Actions
                v-icon(right) mdi-chevron-down
            v-list(dense, nav)
              v-list-item(v-if='!user.isActive', @click='activateUser')
                v-list-item-icon
                  v-icon(color='purple') mdi-account-key
                v-list-item-title Activate
              v-list-item(v-else, @click='deactivateUser', :disabled='user.id == currentUserId || user.isSystem')
                v-list-item-icon
                  v-icon(color='purple') mdi-account-cancel
                v-list-item-title Deactivate
              v-list-item(@click='verifyUser', :disabled='user.isVerified')
                v-list-item-icon
                  v-icon(color='blue') mdi-account-check
                v-list-item-title Set as Verified
              v-list-item(@click='deleteUserConfirm', :disabled='user.id == currentUserId || user.isSystem')
                v-list-item-icon
                  v-icon(color='red') mdi-trash-can-outline
                v-list-item-title Delete
          v-btn.ml-3.animated.fadeInDown(color='primary', large, depressed, @click='updateUser')
            v-icon(left) mdi-check
            span {{$t('admin:users.updateUser')}}
      v-flex(xs6)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-information-variant
            span {{$t('admin:users.basicInfo')}}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-email-variant
              v-list-item-content
                v-list-item-title {{$t('admin:users.email')}}
                v-list-item-subtitle {{ user.email }}
              v-list-item-action(v-if='!user.isSystem && user.providerKey === `local`')
                v-menu(
                  v-model='editPop.email'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptEmail`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptEmail'
                      v-model='user.email'
                      :label='$t(`admin:users.email`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.email = false'
                      @keydown.enter='editPop.email = false'
                      @keydown.esc='editPop.email = false'
                    )

            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account
              v-list-item-content
                v-list-item-title {{$t('admin:users.displayName')}}
                v-list-item-subtitle {{ user.name }}
              v-list-item-action
                v-menu(
                  v-model='editPop.name'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptDisplayName`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptDisplayName'
                      v-model='user.name'
                      :label='$t(`admin:users.displayName`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.name = false'
                      @keydown.enter='editPop.name = false'
                      @keydown.esc='editPop.name = false'
                    )

        v-card.mt-3.animated.fadeInUp.wait-p2s(v-if='!user.isSystem')
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-lock-outline
            span {{$t('admin:users.authentication')}}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-domain
              v-list-item-content
                v-list-item-title {{$t('admin:users.authProvider')}}
                v-list-item-subtitle {{ user.providerName }} #[em.caption ({{ user.providerKey }})]
            template(v-if='user.providerKey === `local`')
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-form-textbox-password
                v-list-item-content
                  v-list-item-title {{$t('admin:users.password')}}
                  v-list-item-subtitle &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                v-list-item-action
                  v-menu(
                    v-model='editPop.newPassword'
                    :close-on-content-click='false'
                    min-width='350'
                    left
                    )
                    template(v-slot:activator='{ on: menu }')
                      v-tooltip(top)
                        template(v-slot:activator='{ on: tooltip }')
                          v-btn(icon, color='grey', x-small, v-on='{ ...menu, ...tooltip }', @click='focusField(`iptNewPassword`)')
                            v-icon mdi-pencil
                        span {{$t('admin:users.changePassword')}}
                    v-card
                      v-text-field(
                        ref='iptNewPassword'
                        v-model='newPassword'
                        :label='$t(`admin:users.newPassword`)'
                        solo
                        hide-details
                        append-icon='mdi-check'
                        type='password'
                        @click:append='editPop.newPassword = false'
                        @keydown.enter='editPop.newPassword = false'
                        @keydown.esc='editPop.newPassword = false'
                      )
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', x-small, v-on='on', disabled)
                        v-icon mdi-email
                    span Send Password Reset Email
            template(v-if='user.providerIs2FACapable')
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-two-factor-authentication
                v-list-item-content
                  v-list-item-title {{$t('admin:users.tfa')}}
                  v-list-item-subtitle.green--text(v-if='user.tfaIsActive') Active
                  v-list-item-subtitle.red--text(v-else) Inactive
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', x-small, v-on='on', @click='toggle2FA')
                        v-icon mdi-power
                    span {{$t('admin:users.toggle2FA')}}
            template(v-if='user.providerId')
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-music-accidental-sharp
                v-list-item-content
                  v-list-item-title {{$t('admin:users.authProviderId')}}
                  v-list-item-subtitle {{ user.providerId }}
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-group
            span {{$t('admin:users.groups')}}
          v-list(dense)
            template(v-for='(group, idx) in user.groups')
              v-list-item(:key='`group-` + group.id')
                v-list-item-avatar(size='32')
                  v-icon mdi-account-group-outline
                v-list-item-content
                  v-list-item-title {{group.name}}
                v-list-item-action(v-if='!user.isSystem')
                  v-btn(icon, color='red', x-small, @click='unassignGroup(group.id)')
                    v-icon mdi-close
              v-divider(v-if='idx < user.groups.length - 1')
          v-alert.mx-3(v-if='user.groups.length < 1', outlined, color='grey darken-1', icon='mdi-alert')
            .caption {{$t('admin:users.noGroupAssigned')}}
          v-card-chin(v-if='!user.isSystem')
            v-spacer
            v-select(
              ref='iptAssignGroup'
              :items='groups'
              v-model='newGroup'
              :label='$t(`admin:users.selectGroup`)'
              item-value='id'
              item-text='name'
              item-disabled='isSystem'
              solo
              flat
              hide-details
              @keydown.esc='editPop.assignGroup = false'
              style='max-width: 300px;'
              dense
            )
            v-btn.ml-2.px-4(depressed, color='primary', @click='assignGroup', :disabled='newGroup === 0')
              v-icon(left) mdi-clipboard-account-outline
              span {{$t('admin:users.groupAssign')}}
          v-system-bar(window, :color='$vuetify.theme.dark ? `grey darken-4-l3` : `grey lighten-3`')
            v-spacer
            .caption {{$t('admin:users.groupAssignNotice')}}

      v-flex(xs6)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-badge-outline
            span {{$t('admin:users.extendedMetadata')}}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-marker
              v-list-item-content
                v-list-item-title {{$t('admin:users.location')}}
                v-list-item-subtitle {{ user.location }}
              v-list-item-action
                v-menu(
                  v-model='editPop.location'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptLocation`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptLocation'
                      v-model='user.location'
                      :label='$t(`admin:users.location`)'
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
                v-list-item-title {{$t('admin:users.jobTitle')}}
                v-list-item-subtitle {{ user.jobTitle }}
              v-list-item-action
                v-menu(
                  v-model='editPop.jobTitle'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptJobTitle`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptJobTitle'
                      v-model='user.jobTitle'
                      :label='$t(`admin:users.jobTitle`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.jobTitle = false'
                      @keydown.enter='editPop.jobTitle = false'
                      @keydown.esc='editPop.jobTitle = false'
                    )
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-clock-outline
              v-list-item-content
                v-list-item-title {{$t('admin:users.timezone')}}
                v-list-item-subtitle {{ user.timezone }}
              v-list-item-action
                v-menu(
                  v-model='editPop.timezone'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptTimezone`)')
                      v-icon mdi-pencil
                  v-card
                    v-select(
                      ref='iptTimezone'
                      :items='timezones'
                      v-model='user.timezone'
                      :label='$t(`admin:users.timezone`)'
                      solo
                      dense
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.timezone = false'
                      @keydown.enter='editPop.timezone = false'
                      @keydown.esc='editPop.timezone = false'
                    )

        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='teal', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:activity.title')}}
          v-card-text.grey--text.text--darken-2
            .caption.grey--text {{$t('profile:activity.joinedOn')}}
            .body-2: strong {{ user.createdAt | date('LLLL') }}
            .caption.grey--text.mt-3 {{$t('profile:activity.lastUpdatedOn')}}
            .body-2: strong {{ user.updatedAt | date('LLLL') }}
            .caption.grey--text.mt-3 {{$t('profile:activity.lastLoginOn')}}
            .body-2: strong {{ user.lastLoginAt | date('LLLL') }}

        //- v-card.mt-3.animated.fadeInUp.wait-p6s
        //-   v-toolbar(color='teal', dense, dark, flat)
        //-     v-icon.mr-2 mdi-file-document-box-multiple-outline
        //-     span Content
        //-   v-card-text
        //-     em.caption.grey--text Coming soon

    v-dialog(v-model='deleteUserDialog', max-width='500')
      v-card
        .dialog-header.is-red {{$t('admin:users.deleteConfirmTitle')}}
        v-card-text.pt-5
          i18next(path='admin:users.deleteConfirmText', tag='span')
            strong(place='username') {{ user.email }}
          .mt-3 {{$t('admin:users.deleteConfirmReplaceWarn')}}
          v-divider.my-3
          .d-flex.align-center.mt-3
            v-btn.text-none(color='primary', depressed, @click='deleteSearchUserDialog = true')
              v-icon(left) mdi-clipboard-account
              | Select User...
            .caption.pl-3
              strong ID {{deleteReplaceUser.id}}
              .caption {{deleteReplaceUser.name}}
              em {{deleteReplaceUser.email}}
        v-card-chin
          v-spacer
          v-btn(text, @click='deleteUserDialog = false') {{$t('common:actions.cancel')}}
          v-btn(color='red', dark, @click='deleteUser') {{$t('common:actions.delete')}}

        user-search(v-model='deleteSearchUserDialog', @select='assignDeleteUser')

</template>
<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import { StatusIndicator } from 'vue-status-indicator'

import UserSearch from '../common/user-search.vue'

import groupsQuery from 'gql/admin/users/users-query-groups.gql'
import { timezones } from '@/helpers'

export default {
  i18nOptions: {
    namespaces: ['admin', 'profile']
  },
  components: {
    StatusIndicator,
    UserSearch
  },
  data () {
    return {
      deleteUserDialog: false,
      deleteSearchUserDialog: false,
      deleteReplaceUser: {
        id: 1,
        name: '',
        email: ''
      },
      editPop: {
        email: false,
        name: false,
        pwd: false,
        location: false,
        jobTitle: false,
        timezone: false,
        newPassword: false,
        assignGroup: false
      },
      newGroup: 0,
      newPassword: '',
      user: {
        email: '',
        name: '',
        location: '',
        jobTitle: '',
        timezone: '',
        groups: [],
        isActive: false,
        isVerified: false
      },
      timezones: timezones()
    }
  },
  computed: {
    currentUserId: get('user/id')
  },
  methods: {
    /**
     * Activate a user (if previously deactivated)
     */
    async activateUser () {
      this.$store.commit(`loadingStart`, 'admin-users-activate')
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!) {
            users {
              activate(id: $id) {
                responseResult {
                  succeeded
                  errorCode
                  slug
                  message
                }
              }
            }
          }
        `,
        variables: {
          id: this.user.id
        }
      })
      if (_.get(resp, 'data.users.activate.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:users.userActivateSuccess'),
          icon: 'check'
        })
        this.user.isActive = true
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.users.activate.responseResult.message', 'An unexpected error occurred.'),
          icon: 'warning'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-users-activate')
    },
    /**
     * Deactivate a currently active user
     */
    async deactivateUser () {
      this.$store.commit(`loadingStart`, 'admin-users-deactivate')
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!) {
            users {
              deactivate(id: $id) {
                responseResult {
                  succeeded
                  errorCode
                  slug
                  message
                }
              }
            }
          }
        `,
        variables: {
          id: this.user.id
        }
      })
      if (_.get(resp, 'data.users.deactivate.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:users.userDeactivateSuccess'),
          icon: 'check'
        })
        this.user.isActive = false
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.users.deactivate.responseResult.message', 'An unexpected error occurred.'),
          icon: 'warning'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-users-deactivate')
    },
    /**
     * Delete a user
     */
    deleteUserConfirm () {
      this.deleteUserDialog = true
      this.deleteReplaceUser = {
        id: this.currentUserId,
        name: this.$store.get('user/name'),
        email: this.$store.get('user/email')
      }
    },
    async deleteUser () {
      this.$store.commit(`loadingStart`, 'admin-users-delete')
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!, $replaceId: Int!) {
            users {
              delete(id: $id, replaceId: $replaceId) {
                responseResult {
                  succeeded
                  errorCode
                  slug
                  message
                }
              }
            }
          }
        `,
        variables: {
          id: this.user.id,
          replaceId: this.deleteReplaceUser.id
        }
      })
      if (_.get(resp, 'data.users.delete.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:users.userDeleteSuccess'),
          icon: 'check'
        })
        this.$router.push('/users')
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.users.delete.responseResult.message', 'An unexpected error occurred.'),
          icon: 'warning'
        })
      }
      this.deleteUserDialog = false
      this.$store.commit(`loadingStop`, 'admin-users-delete')
    },
    assignDeleteUser (selUsr) {
      if (selUsr.id === this.user.id) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'You cannot select the account you\'re about to delete!',
          icon: 'warning'
        })
      } else if (selUsr.id === 2) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'You cannot use the guest account for this operation.',
          icon: 'warning'
        })
      } else {
        this.deleteReplaceUser = selUsr
      }
    },
    /**
     * Update a user
     */
    async updateUser() {
      this.$store.commit(`loadingStart`, 'admin-users-update')
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!, $email: String, $name: String, $newPassword: String, $groups: [Int], $location: String, $jobTitle: String, $timezone: String) {
            users {
              update(id: $id, email: $email, name: $name, newPassword: $newPassword, groups: $groups, location: $location, jobTitle: $jobTitle, timezone: $timezone) {
                responseResult {
                  succeeded
                  errorCode
                  slug
                  message
                }
              }
            }
          }
        `,
        variables: {
          id: this.user.id,
          email: this.user.email,
          name: this.user.name,
          newPassword: this.newPassword,
          groups: _.map(this.user.groups, 'id'),
          location: this.user.location,
          jobTitle: this.user.jobTitle,
          timezone: this.user.timezone
        }
      })
      this.newPassword = ''
      if (_.get(resp, 'data.users.update.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:users.userUpdateSuccess'),
          icon: 'check'
        })
        this.$router.push('/users')
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.users.update.responseResult.message', 'An unexpected error occurred.'),
          icon: 'warning'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-users-update')
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
     * Assign group to user
     */
    assignGroup() {
      if (_.some(this.user.groups, ['id', this.newGroup])) {
        this.$store.commit('showNotification', {
          message: this.$t('admin:users.userAlreadyAssignedToGroup'),
          style: 'error',
          icon: 'alert'
        })
      } else {
        this.user.groups.push(_.find(this.groups, ['id', this.newGroup]))
        this.newGroup = 0
      }
    },
    /**
     * Unassign group from user
     */
    unassignGroup(gid) {
      this.user.groups = _.reject(this.user.groups, ['id', gid])
    },
    /**
     * Manually set user as verified
     */
    async verifyUser () {
      this.$store.commit(`loadingStart`, 'admin-users-verify')
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation ($id: Int!) {
            users {
              verify(id: $id) {
                responseResult {
                  succeeded
                  errorCode
                  slug
                  message
                }
              }
            }
          }
        `,
        variables: {
          id: this.user.id
        }
      })
      if (_.get(resp, 'data.users.verify.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:users.userVerifySuccess'),
          icon: 'check'
        })
        this.user.isVerified = true
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.users.verify.responseResult.message', 'An unexpected error occurred.'),
          icon: 'warning'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-users-verify')
    },
    /**
     * Toggle 2FA State
     */
    async toggle2FA () {
      this.$store.commit(`loadingStart`, 'admin-users-toggle2fa')
      if (this.user.tfaIsActive) {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              users {
                disableTFA(id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.user.id
          }
        })
        if (_.get(resp, 'data.users.disableTFA.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('admin:users.userTFADisableSuccess'),
            icon: 'check'
          })
          this.user.tfaIsActive = false
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.users.disableTFA.responseResult.message', 'An unexpected error occurred.'),
            icon: 'warning'
          })
        }
      } else {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              users {
                enableTFA(id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.user.id
          }
        })
        if (_.get(resp, 'data.users.enableTFA.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('admin:users.userTFAEnableSuccess'),
            icon: 'check'
          })
          this.user.tfaIsActive = true
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.users.enableTFA.responseResult.message', 'An unexpected error occurred.'),
            icon: 'warning'
          })
        }
      }
      this.$store.commit(`loadingStop`, 'admin-users-toggle2fa')
    }
  },
  apollo: {
    user: {
      query: gql`
        query ($id: Int!) {
          users {
            single(id: $id) {
              id
              name
              email
              providerKey
              providerName
              providerId
              providerIs2FACapable
              location
              jobTitle
              timezone
              isSystem
              isActive
              isVerified
              createdAt
              updatedAt
              lastLoginAt
              tfaIsActive
              groups {
                id
                name
              }
            }
          }
        }
      `,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.users.single,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-refresh')
      }
    },
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
