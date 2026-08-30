<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-file.svg', alt='Assets', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:assets.title', { defaultValue: 'Assets' })}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{$t('admin:assets.subtitle', { defaultValue: 'Manage uploaded files and folders' })}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s.mr-3(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='primary', depressed, large, @click='uploadDialog = true')
            v-icon(left) mdi-cloud-upload
            span {{$t('common:actions.upload')}}
      v-flex(xs12, md4, lg3)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title.subtitle-1 {{$t('admin:assets.folders', { defaultValue: 'Folders' })}}
            v-spacer
            v-menu(offset-y, min-width='220')
              template(v-slot:activator='{ on }')
                v-btn(icon, small, v-on='on')
                  v-icon mdi-dots-vertical
              v-list(nav, dense)
                v-list-item(@click='newFolderDialog = true')
                  v-list-item-icon: v-icon(color='primary') mdi-folder-plus
                  v-list-item-title {{$t('admin:assets.newFolder', { defaultValue: 'New Folder' })}}
                template(v-if='currentFolderId > 0')
                  v-list-item(@click='openRenameFolderDialog')
                    v-list-item-icon: v-icon(color='orange') mdi-folder-edit
                    v-list-item-title {{$t('common:actions.rename')}}
                  v-list-item(@click='moveFolderDialog = true')
                    v-list-item-icon: v-icon(color='blue') mdi-folder-move
                    v-list-item-title {{$t('common:actions.move')}}
                  v-list-item(@click='deleteFolderDialog = true')
                    v-list-item-icon: v-icon(color='red') mdi-folder-remove
                    v-list-item-title {{$t('common:actions.delete')}}
          v-treeview.admin-assets-tree(
            :items='folderTreeNested'
            :active.sync='selectedFolders'
            item-key='id'
            activatable
            hoverable
            dense
            :open.sync='openFolders'
          )
            template(v-slot:prepend='{ item, active, open }')
              v-icon(:color='active ? `primary` : ``') {{ item.id === 0 ? 'mdi-home' : (open ? 'mdi-folder-open' : 'mdi-folder') }}
            template(v-slot:label='{ item }')
              .admin-assets-tree-label(
                @dragover.prevent='dragOverFolderId = item.id'
                @dragleave='dragOverFolderId = null'
                @drop.prevent='dropOnFolder(item)'
                :class='dragOverFolderId === item.id ? `admin-assets-tree-label--dragover` : ``'
                ) {{ item.name }}
      v-flex(xs12, md8, lg9)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(flat, :color='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-4`', dense)
            .body-2 /{{ currentFolderPath }}
            v-spacer
            template(v-if='selectedAssets.length > 0')
              v-btn.mr-2(small, outlined, color='blue', @click='bulkMove')
                v-icon(left, small) mdi-file-move
                span {{$t('common:actions.move')}} ({{selectedAssets.length}})
              v-btn(small, outlined, color='red', @click='bulkDelete')
                v-icon(left, small) mdi-trash-can-outline
                span {{$t('common:actions.delete')}} ({{selectedAssets.length}})
          v-divider
          v-data-table(
            v-model='selectedAssets'
            :items='assets'
            :headers='headers'
            :loading='loading'
            :items-per-page='15'
            must-sort
            sort-by='filename'
            show-select
            item-key='id'
          )
            template(v-slot:item.filename='{ item }')
              .d-flex.align-center(
                draggable='true'
                @dragstart='dragAsset(item, $event)'
                )
                v-icon.mr-2(v-if='item.kind === `IMAGE`', color='green') mdi-file-image
                v-icon.mr-2(v-else, color='grey darken-1') mdi-file
                .body-2 {{ item.filename }}
            template(v-slot:item.fileSize='{ item }')
              span.caption {{ item.fileSize | prettyBytes }}
            template(v-slot:item.updatedAt='{ item }')
              span.caption {{ item.updatedAt | moment('calendar') }}
            template(v-slot:item.actions='{ item }')
              v-menu(offset-x, min-width='200')
                template(v-slot:activator='{ on }')
                  v-btn(icon, small, v-on='on')
                    v-icon(color='grey darken-2') mdi-dots-horizontal
                v-list(nav, dense)
                  v-list-item(:href='`/` + assetFullPath(item)', target='_blank')
                    v-list-item-icon: v-icon(color='green') mdi-open-in-new
                    v-list-item-title {{$t('common:actions.view')}}
                  v-list-item(@click='openRenameAssetDialog(item)')
                    v-list-item-icon: v-icon(color='orange') mdi-keyboard-outline
                    v-list-item-title {{$t('common:actions.rename')}}
                  v-list-item(@click='openMoveAssetDialog(item)')
                    v-list-item-icon: v-icon(color='blue') mdi-file-move
                    v-list-item-title {{$t('common:actions.move')}}
                  v-list-item(@click='openDeleteAssetDialog(item)')
                    v-list-item-icon: v-icon(color='red') mdi-trash-can-outline
                    v-list-item-title {{$t('common:actions.delete')}}
            template(v-slot:no-data)
              v-alert.ma-3(icon='mdi-folder-open-outline', outlined, color='primary') {{$t('admin:assets.folderEmpty', { defaultValue: 'This folder is empty.' })}}

    //- UPLOAD DIALOG
    v-dialog(v-model='uploadDialog', max-width='550')
      v-card
        .dialog-header.is-short
          v-icon.mr-2(color='white') mdi-cloud-upload
          span {{$t('common:actions.upload')}}
        v-card-text.pt-5
          .body-2.pb-3 /{{ currentFolderPath }}
          file-pond(
            name='mediaUpload'
            ref='pond'
            :label-idle='$t(`admin:assets.uploadHint`, { defaultValue: `Drag & drop files here or click to browse...` })'
            allow-multiple='true'
            :files='files'
            max-files='10'
            :server='filePondServerOpts'
            :instant-upload='false'
            :allow-revert='false'
            @processfile='onFileProcessed'
          )
        v-card-chin
          v-spacer
          v-btn(text, @click='uploadDialog = false') {{$t('common:actions.close')}}
          v-btn.px-3(color='primary', @click='upload') {{$t('common:actions.upload')}}

    //- NEW FOLDER DIALOG
    v-dialog(v-model='newFolderDialog', max-width='550')
      v-card
        .dialog-header.is-short
          v-icon.mr-2(color='white') mdi-folder-plus
          span {{$t('admin:assets.newFolder', { defaultValue: 'New Folder' })}}
        v-card-text.pt-5
          v-text-field(
            outlined
            prepend-icon='mdi-folder-outline'
            v-model='newFolderName'
            :label='$t(`admin:assets.folderName`, { defaultValue: `Folder name` })'
            counter='255'
            @keyup.enter='createFolder'
            @keyup.esc='newFolderDialog = false'
          )
        v-card-chin
          v-spacer
          v-btn(text, @click='newFolderDialog = false') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='primary', @click='createFolder', :disabled='!isFolderNameValid', :loading='actionLoading') {{$t('common:actions.create')}}

    //- RENAME FOLDER DIALOG
    v-dialog(v-model='renameFolderDialog', max-width='550')
      v-card
        .dialog-header.is-short.is-orange
          v-icon.mr-2(color='white') mdi-folder-edit
          span {{$t('common:actions.rename')}}
        v-card-text.pt-5
          v-text-field(
            outlined
            prepend-icon='mdi-folder-outline'
            v-model='renameFolderName'
            counter='255'
            @keyup.enter='renameFolder'
            @keyup.esc='renameFolderDialog = false'
          )
        v-card-chin
          v-spacer
          v-btn(text, @click='renameFolderDialog = false') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='orange darken-3', dark, @click='renameFolder', :loading='actionLoading') {{$t('common:actions.rename')}}

    //- MOVE FOLDER DIALOG
    v-dialog(v-model='moveFolderDialog', max-width='550')
      v-card
        .dialog-header.is-short
          v-icon.mr-2(color='white') mdi-folder-move
          span {{$t('common:actions.move')}}
        v-card-text.pt-5
          .body-2.pb-3 {{$t('admin:assets.moveFolderTarget', { defaultValue: 'Select the destination folder:' })}}
          v-treeview(
            :items='folderTreeNested'
            :active.sync='moveTargetFolders'
            item-key='id'
            activatable
            hoverable
            dense
          )
            template(v-slot:prepend='{ item, active }')
              v-icon(:color='active ? `primary` : ``') {{ item.id === 0 ? 'mdi-home' : 'mdi-folder' }}
        v-card-chin
          v-spacer
          v-btn(text, @click='moveFolderDialog = false') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='primary', @click='moveFolder', :disabled='moveTargetFolders.length < 1', :loading='actionLoading') {{$t('common:actions.move')}}

    //- DELETE FOLDER DIALOG
    v-dialog(v-model='deleteFolderDialog', max-width='550')
      v-card
        .dialog-header.is-short.is-red
          v-icon.mr-2(color='white') mdi-folder-remove
          span {{$t('common:actions.delete')}}
        v-card-text.pt-5
          .body-2 {{$t('admin:assets.deleteFolderConfirm', { defaultValue: 'Are you sure you want to delete this folder?' })}}
          .body-2.red--text.text--darken-2 /{{ currentFolderPath }}
          v-checkbox(
            v-model='deleteFolderContents'
            color='red darken-2'
            :label='$t(`admin:assets.deleteFolderContents`, { defaultValue: `Also delete all files and subfolders it contains` })'
            hide-details
          )
          .caption.mt-3.red--text(v-if='deleteFolderContents') {{$t('admin:assets.deleteFolderContentsWarn', { defaultValue: 'All contained files will be permanently deleted!' })}}
        v-card-chin
          v-spacer
          v-btn(text, @click='deleteFolderDialog = false') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='red darken-2', dark, @click='deleteFolder', :loading='actionLoading') {{$t('common:actions.delete')}}

    //- RENAME ASSET DIALOG
    v-dialog(v-model='renameAssetDialog', max-width='550')
      v-card
        .dialog-header.is-short.is-orange
          v-icon.mr-2(color='white') mdi-keyboard
          span {{$t('common:actions.rename')}}
        v-card-text.pt-5
          v-text-field(
            outlined
            single-line
            :counter='255'
            v-model='renameAssetName'
            @keyup.enter='renameAsset'
            :disabled='actionLoading'
          )
        v-card-chin
          v-spacer
          v-btn(text, @click='renameAssetDialog = false', :disabled='actionLoading') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='orange darken-3', dark, @click='renameAsset', :loading='actionLoading') {{$t('common:actions.rename')}}

    //- MOVE ASSET(S) DIALOG
    v-dialog(v-model='moveAssetDialog', max-width='550')
      v-card
        .dialog-header.is-short
          v-icon.mr-2(color='white') mdi-file-move
          span {{$t('common:actions.move')}}
        v-card-text.pt-5
          .body-2.pb-3 {{$t('admin:assets.moveAssetTarget', { defaultValue: 'Select the destination folder:' })}}
          v-treeview(
            :items='folderTreeNested'
            :active.sync='moveTargetFolders'
            item-key='id'
            activatable
            hoverable
            dense
          )
            template(v-slot:prepend='{ item, active }')
              v-icon(:color='active ? `primary` : ``') {{ item.id === 0 ? 'mdi-home' : 'mdi-folder' }}
        v-card-chin
          v-spacer
          v-btn(text, @click='moveAssetDialog = false') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='primary', @click='moveAssets', :disabled='moveTargetFolders.length < 1', :loading='actionLoading') {{$t('common:actions.move')}}

    //- DELETE ASSET(S) DIALOG
    v-dialog(v-model='deleteAssetDialog', max-width='550')
      v-card
        .dialog-header.is-short.is-red
          v-icon.mr-2(color='white') mdi-trash-can-outline
          span {{$t('common:actions.delete')}}
        v-card-text.pt-5
          .body-2 {{$t('admin:assets.deleteAssetConfirm', { defaultValue: 'Are you sure you want to delete the following file(s)?' })}}
          .body-2.red--text.text--darken-2(v-for='a of assetsPendingAction', :key='`del-` + a.id') {{ a.filename }}
        v-card-chin
          v-spacer
          v-btn(text, @click='deleteAssetDialog = false', :disabled='actionLoading') {{$t('common:actions.cancel')}}
          v-btn.px-3(color='red darken-2', dark, @click='deleteAssets', :loading='actionLoading') {{$t('common:actions.delete')}}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import Cookies from 'js-cookie'
import vueFilePond from 'vue-filepond'
import 'filepond/dist/filepond.min.css'

const FilePond = vueFilePond()
const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i
const disallowedFolderChars = /[A-Z()=.!@#$%?&*+`~<>,;:\\/[\]¬{| ]/

export default {
  components: {
    FilePond
  },
  data() {
    return {
      folderTree: [],
      assets: [],
      files: [],
      selectedFolders: [0],
      openFolders: [0],
      selectedAssets: [],
      loading: false,
      actionLoading: false,
      dragOverFolderId: null,
      draggedAssetId: null,
      uploadDialog: false,
      newFolderDialog: false,
      newFolderName: '',
      renameFolderDialog: false,
      renameFolderName: '',
      moveFolderDialog: false,
      moveTargetFolders: [],
      deleteFolderDialog: false,
      deleteFolderContents: false,
      renameAssetDialog: false,
      renameAssetName: '',
      moveAssetDialog: false,
      deleteAssetDialog: false,
      assetsPendingAction: []
    }
  },
  computed: {
    currentFolderId () {
      return _.head(this.selectedFolders) || 0
    },
    currentFolder () {
      return _.find(this.folderTree, ['id', this.currentFolderId]) || { id: 0, name: '/', path: '' }
    },
    currentFolderPath () {
      return this.currentFolder.path || ''
    },
    folderTreeNested () {
      const buildChildren = parentId => {
        return _.sortBy(_.filter(this.folderTree, ['parentId', parentId]), 'name').map(f => ({
          id: f.id,
          name: f.name || f.slug,
          path: f.path,
          children: buildChildren(f.id)
        }))
      }
      return [{
        id: 0,
        name: '/ root',
        path: '',
        children: buildChildren(0)
      }]
    },
    headers () {
      return _.compact([
        { text: this.$t('admin:assets.headerFilename', { defaultValue: 'Filename' }), value: 'filename' },
        this.$vuetify.breakpoint.mdAndUp && { text: this.$t('admin:assets.headerType', { defaultValue: 'Type' }), value: 'ext', width: 90 },
        this.$vuetify.breakpoint.mdAndUp && { text: this.$t('admin:assets.headerFileSize', { defaultValue: 'Size' }), value: 'fileSize', width: 110 },
        this.$vuetify.breakpoint.lgAndUp && { text: this.$t('admin:assets.headerUpdated', { defaultValue: 'Updated' }), value: 'updatedAt', width: 175 },
        { text: '', value: 'actions', width: 60, sortable: false, align: 'right' }
      ])
    },
    isFolderNameValid () {
      return this.newFolderName.length > 1 && !localeSegmentRegex.test(this.newFolderName) && !disallowedFolderChars.test(this.newFolderName)
    },
    filePondServerOpts () {
      const jwtToken = Cookies.get('jwt')
      return {
        process: {
          url: '/u',
          headers: {
            'Authorization': `Bearer ${jwtToken}`
          }
        }
      }
    }
  },
  watch: {
    currentFolderId () {
      this.selectedAssets = []
    }
  },
  filters: {
    prettyBytes (num) {
      if (typeof num !== 'number' || isNaN(num)) {
        return '0 B'
      }
      let exponent
      let unit
      let neg = num < 0
      let units = ['B', 'kB', 'MB', 'GB', 'TB']
      if (neg) {
        num = -num
      }
      if (num < 1) {
        return (neg ? '-' : '') + num + ' B'
      }
      exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1)
      num = (num / Math.pow(1000, exponent)).toFixed(2) * 1
      unit = units[exponent]
      return (neg ? '-' : '') + num + ' ' + unit
    }
  },
  methods: {
    assetFullPath (asset) {
      return this.currentFolderPath ? `${this.currentFolderPath}/${asset.filename}` : asset.filename
    },
    async refresh () {
      await this.$apollo.queries.folderTree.refetch()
      await this.$apollo.queries.assets.refetch()
      this.$store.commit('showNotification', {
        message: this.$t('admin:assets.refreshSuccess', { defaultValue: 'List of assets refreshed successfully.' }),
        style: 'success',
        icon: 'check'
      })
    },
    async runMutation ({ mutation, variables, resultPath, successMsg, onSuccess }) {
      this.actionLoading = true
      try {
        const resp = await this.$apollo.mutate({ mutation, variables })
        if (_.get(resp, `data.assets.${resultPath}.responseResult.succeeded`, false)) {
          this.$store.commit('showNotification', {
            message: successMsg,
            style: 'success',
            icon: 'check'
          })
          if (onSuccess) {
            await onSuccess()
          }
          this.actionLoading = false
          return true
        } else {
          this.$store.commit('pushGraphError', new Error(_.get(resp, `data.assets.${resultPath}.responseResult.message`)))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.actionLoading = false
      return false
    },
    async createFolder () {
      const ok = await this.runMutation({
        mutation: gql`
          mutation ($parentFolderId: Int!, $slug: String!) {
            assets {
              createFolder(parentFolderId: $parentFolderId, slug: $slug) {
                responseResult { succeeded errorCode slug message }
              }
            }
          }
        `,
        variables: {
          parentFolderId: this.currentFolderId,
          slug: this.newFolderName
        },
        resultPath: 'createFolder',
        successMsg: this.$t('admin:assets.folderCreateSuccess', { defaultValue: 'Folder created successfully.' }),
        onSuccess: () => this.$apollo.queries.folderTree.refetch()
      })
      if (ok) {
        this.newFolderDialog = false
        this.newFolderName = ''
      }
    },
    openRenameFolderDialog () {
      this.renameFolderName = this.currentFolder.name || ''
      this.renameFolderDialog = true
    },
    async renameFolder () {
      const ok = await this.runMutation({
        mutation: gql`
          mutation ($id: Int!, $slug: String!) {
            assets {
              renameFolder(id: $id, slug: $slug) {
                responseResult { succeeded errorCode slug message }
              }
            }
          }
        `,
        variables: {
          id: this.currentFolderId,
          slug: this.renameFolderName
        },
        resultPath: 'renameFolder',
        successMsg: this.$t('admin:assets.folderRenameSuccess', { defaultValue: 'Folder renamed successfully.' }),
        onSuccess: () => this.$apollo.queries.folderTree.refetch()
      })
      if (ok) {
        this.renameFolderDialog = false
      }
    },
    async moveFolder () {
      const targetId = _.head(this.moveTargetFolders)
      const ok = await this.runMutation({
        mutation: gql`
          mutation ($id: Int!, $parentFolderId: Int!) {
            assets {
              moveFolder(id: $id, parentFolderId: $parentFolderId) {
                responseResult { succeeded errorCode slug message }
              }
            }
          }
        `,
        variables: {
          id: this.currentFolderId,
          parentFolderId: targetId
        },
        resultPath: 'moveFolder',
        successMsg: this.$t('admin:assets.folderMoveSuccess', { defaultValue: 'Folder moved successfully.' }),
        onSuccess: () => this.$apollo.queries.folderTree.refetch()
      })
      if (ok) {
        this.moveFolderDialog = false
        this.moveTargetFolders = []
      }
    },
    async deleteFolder () {
      const ok = await this.runMutation({
        mutation: gql`
          mutation ($id: Int!, $deleteContents: Boolean) {
            assets {
              deleteFolder(id: $id, deleteContents: $deleteContents) {
                responseResult { succeeded errorCode slug message }
              }
            }
          }
        `,
        variables: {
          id: this.currentFolderId,
          deleteContents: this.deleteFolderContents
        },
        resultPath: 'deleteFolder',
        successMsg: this.$t('admin:assets.folderDeleteSuccess', { defaultValue: 'Folder deleted successfully.' }),
        onSuccess: async () => {
          this.selectedFolders = [0]
          this.deleteFolderContents = false
          await this.$apollo.queries.folderTree.refetch()
          await this.$apollo.queries.assets.refetch()
        }
      })
      if (ok) {
        this.deleteFolderDialog = false
      }
    },
    openRenameAssetDialog (asset) {
      this.assetsPendingAction = [asset]
      this.renameAssetName = asset.filename
      this.renameAssetDialog = true
    },
    async renameAsset () {
      const asset = _.head(this.assetsPendingAction)
      const ok = await this.runMutation({
        mutation: gql`
          mutation ($id: Int!, $filename: String!) {
            assets {
              renameAsset(id: $id, filename: $filename) {
                responseResult { succeeded errorCode slug message }
              }
            }
          }
        `,
        variables: {
          id: asset.id,
          filename: this.renameAssetName
        },
        resultPath: 'renameAsset',
        successMsg: this.$t('admin:assets.renameSuccess', { defaultValue: 'Asset renamed successfully.' }),
        onSuccess: () => this.$apollo.queries.assets.refetch()
      })
      if (ok) {
        this.renameAssetDialog = false
      }
    },
    openMoveAssetDialog (asset) {
      this.assetsPendingAction = [asset]
      this.moveAssetDialog = true
    },
    async moveAssets () {
      const targetId = _.head(this.moveTargetFolders)
      let allOk = true
      for (const asset of this.assetsPendingAction) {
        const ok = await this.runMutation({
          mutation: gql`
            mutation ($id: Int!, $folderId: Int!) {
              assets {
                moveAsset(id: $id, folderId: $folderId) {
                  responseResult { succeeded errorCode slug message }
                }
              }
            }
          `,
          variables: {
            id: asset.id,
            folderId: targetId
          },
          resultPath: 'moveAsset',
          successMsg: this.$t('admin:assets.moveSuccess', { defaultValue: 'Asset moved successfully.' })
        })
        if (!ok) {
          allOk = false
          break
        }
      }
      await this.$apollo.queries.assets.refetch()
      if (allOk) {
        this.moveAssetDialog = false
        this.moveTargetFolders = []
        this.assetsPendingAction = []
        this.selectedAssets = []
      }
    },
    openDeleteAssetDialog (asset) {
      this.assetsPendingAction = [asset]
      this.deleteAssetDialog = true
    },
    async deleteAssets () {
      let allOk = true
      for (const asset of this.assetsPendingAction) {
        const ok = await this.runMutation({
          mutation: gql`
            mutation ($id: Int!) {
              assets {
                deleteAsset(id: $id) {
                  responseResult { succeeded errorCode slug message }
                }
              }
            }
          `,
          variables: {
            id: asset.id
          },
          resultPath: 'deleteAsset',
          successMsg: this.$t('admin:assets.deleteSuccess', { defaultValue: 'Asset deleted successfully.' })
        })
        if (!ok) {
          allOk = false
          break
        }
      }
      await this.$apollo.queries.assets.refetch()
      if (allOk) {
        this.deleteAssetDialog = false
        this.assetsPendingAction = []
        this.selectedAssets = []
      }
    },
    dragAsset (asset, ev) {
      this.draggedAssetId = asset.id
      ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer.setData('text/plain', `${asset.id}`)
    },
    async dropOnFolder (folderItem) {
      this.dragOverFolderId = null
      if (!this.draggedAssetId) {
        return
      }
      const asset = _.find(this.assets, ['id', this.draggedAssetId])
      this.draggedAssetId = null
      if (!asset || folderItem.id === this.currentFolderId) {
        return
      }
      this.assetsPendingAction = [asset]
      this.moveTargetFolders = [folderItem.id]
      await this.moveAssets()
    },
    async upload () {
      const files = this.$refs.pond.getFiles()
      if (files.length < 1) {
        return this.$store.commit('showNotification', {
          message: this.$t('admin:assets.noUploadError', { defaultValue: 'You must choose a file to upload first!' }),
          style: 'warning',
          icon: 'warning'
        })
      }
      for (let file of files) {
        file.setMetadata({
          folderId: this.currentFolderId
        })
      }
      await this.$refs.pond.processFiles()
    },
    async onFileProcessed (err, file) {
      if (err) {
        return this.$store.commit('showNotification', {
          message: this.$t('admin:assets.uploadFailed', { defaultValue: 'Upload failed' }),
          style: 'error',
          icon: 'alert'
        })
      }
      _.delay(() => {
        if (this.$refs.pond) {
          this.$refs.pond.removeFile(file.id)
        }
      }, 3000)
      await this.$apollo.queries.assets.refetch()
    },
    // -> Bulk actions (from data table selection)
    bulkMove () {
      this.assetsPendingAction = [...this.selectedAssets]
      this.moveAssetDialog = true
    },
    bulkDelete () {
      this.assetsPendingAction = [...this.selectedAssets]
      this.deleteAssetDialog = true
    }
  },
  apollo: {
    folderTree: {
      query: gql`
        {
          assets {
            folderTree {
              id
              slug
              name
              parentId
              path
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => data.assets.folderTree,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-assets-folders-refresh')
      }
    },
    assets: {
      query: gql`
        query ($folderId: Int!) {
          assets {
            list(folderId: $folderId, kind: ALL) {
              id
              filename
              ext
              kind
              mime
              fileSize
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables () {
        return {
          folderId: this.currentFolderId
        }
      },
      throttle: 1000,
      fetchPolicy: 'network-only',
      update: (data) => data.assets.list,
      watchLoading (isLoading) {
        this.loading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-assets-list-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.admin-assets-tree {
  .admin-assets-tree-label {
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;

    &--dragover {
      background-color: mc('theme', 'accent');
      color: #FFF;
    }
  }
}
</style>
