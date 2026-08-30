<template lang="pug">
  v-app.editor(:dark='$vuetify.theme.dark')
    nav-header(dense)
      template(slot='mid')
        v-text-field.editor-title-input(
          dark
          solo
          flat
          v-model='currentPageTitle'
          hide-details
          background-color='black'
          dense
          full-width
        )
      template(slot='actions')
        v-btn.mr-3.animated.fadeIn(color='amber', outlined, small, v-if='isConflict', @click='openConflict')
          .overline.amber--text.mr-3 Conflict
          status-indicator(intermediary, pulse)
        v-btn.animated.fadeInDown(
          text
          color='green'
          @click.exact='save'
          @click.ctrl.exact='saveAndClose'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown }'
          )
          v-icon(color='green', :left='$vuetify.breakpoint.lgAndUp') mdi-check
          span.grey--text(v-if='$vuetify.breakpoint.lgAndUp && mode !== `create` && !isDirty') {{ $t('editor:save.saved') }}
          span.white--text(v-else-if='$vuetify.breakpoint.lgAndUp') {{ mode === 'create' ? $t('common:actions.create') : $t('common:actions.save') }}
        v-btn.animated.fadeInDown.wait-p1s(
          text
          color='blue'
          @click='openPropsModal'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown, "mx-0": !welcomeMode, "ml-0": welcomeMode }'
          )
          v-icon(color='blue', :left='$vuetify.breakpoint.lgAndUp') mdi-tag-text-outline
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ $t('common:actions.page') }}
        v-btn.animated.fadeInDown.wait-p2s(
          v-if='!welcomeMode'
          text
          color='red'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown }'
          @click='exit'
          )
          v-icon(color='red', :left='$vuetify.breakpoint.lgAndUp') mdi-close
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ $t('common:actions.close') }}
        v-divider.ml-3(vertical)
    v-main
      component(:is='currentEditor', :save='save')
      editor-modal-properties(v-model='dialogProps')
      editor-modal-editorselect(v-model='dialogEditorSelector')
      editor-modal-unsaved(v-model='dialogUnsaved', @discard='exitGo')
      component(:is='activeModal')

    v-snackbar(v-model='draftBannerShown', :timeout='-1', bottom)
      .body-2 {{$t('editor:draft.found', { defaultValue: 'An unsaved draft of this page was found.' })}}
      .caption(v-if='draftFound') {{ draftFound.updatedAt | moment('calendar') }}
      template(v-slot:action='{ attrs }')
        v-btn(text, color='green lighten-2', v-bind='attrs', @click='restoreDraft') {{$t('editor:draft.restore', { defaultValue: 'Restore' })}}
        v-btn(text, color='orange lighten-2', v-bind='attrs', @click='discardDraftAction') {{$t('editor:draft.discard', { defaultValue: 'Discard' })}}

    loader(v-model='dialogProgress', :title='$t(`editor:save.processing`)', :subtitle='$t(`editor:save.pleaseWait`)')
    notify
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get, sync } from 'vuex-pathify'
import { AtomSpinner } from 'epic-spinners'
import { Base64 } from 'js-base64'
import { StatusIndicator } from 'vue-status-indicator'

import editorStore from '../store/editor'

/* global WIKI */

WIKI.$store.registerModule('editor', editorStore)

export default {
  i18nOptions: { namespaces: 'editor' },
  components: {
    AtomSpinner,
    StatusIndicator,
    editorApi: () => import(/* webpackChunkName: "editor-api", webpackMode: "lazy" */ './editor/editor-api.vue'),
    editorCode: () => import(/* webpackChunkName: "editor-code", webpackMode: "lazy" */ './editor/editor-code.vue'),
    editorCkeditor: () => import(/* webpackChunkName: "editor-ckeditor", webpackMode: "lazy" */ './editor/editor-ckeditor.vue'),
    editorAsciidoc: () => import(/* webpackChunkName: "editor-asciidoc", webpackMode: "lazy" */ './editor/editor-asciidoc.vue'),
    editorMarkdown: () => import(/* webpackChunkName: "editor-markdown", webpackMode: "lazy" */ './editor/editor-markdown.vue'),
    editorRedirect: () => import(/* webpackChunkName: "editor-redirect", webpackMode: "lazy" */ './editor/editor-redirect.vue'),
    editorModalEditorselect: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-editorselect.vue'),
    editorModalProperties: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-properties.vue'),
    editorModalUnsaved: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-unsaved.vue'),
    editorModalMedia: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-media.vue'),
    editorModalBlocks: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-blocks.vue'),
    editorModalConflict: () => import(/* webpackChunkName: "editor-conflict", webpackMode: "lazy" */ './editor/editor-modal-conflict.vue'),
    editorModalDrawio: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-drawio.vue')
  },
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    },
    tags: {
      type: Array,
      default: () => ([])
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    isTemplate: {
      type: Boolean,
      default: false
    },
    scriptCss: {
      type: String,
      default: ''
    },
    publishStartDate: {
      type: String,
      default: ''
    },
    publishEndDate: {
      type: String,
      default: ''
    },
    scriptJs: {
      type: String,
      default: ''
    },
    initEditor: {
      type: String,
      default: null
    },
    initMode: {
      type: String,
      default: 'create'
    },
    initContent: {
      type: String,
      default: null
    },
    pageId: {
      type: Number,
      default: 0
    },
    checkoutDate: {
      type: String,
      default: new Date().toISOString()
    },
    effectivePermissions: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      isSaving: false,
      isConflict: false,
      dialogProps: false,
      dialogProgress: false,
      dialogEditorSelector: false,
      dialogUnsaved: false,
      exitConfirmed: false,
      initContentParsed: '',
      draftFound: null,
      draftBannerShown: false,
      draftAutosaveHandle: null,
      lastDraftContent: '',
      savedState: {
        description: '',
        isPublished: false,
        isTemplate: false,
        publishEndDate: '',
        publishStartDate: '',
        tags: '',
        title: '',
        css: '',
        js: ''
      }
    }
  },
  computed: {
    currentEditor: sync('editor/editor'),
    activeModal: sync('editor/activeModal'),
    mode: get('editor/mode'),
    welcomeMode() { return this.mode === `create` && this.path === `home` },
    currentPageTitle: sync('page/title'),
    checkoutDateActive: sync('editor/checkoutDateActive'),
    currentStyling: get('page/scriptCss'),
    isDirty () {
      return _.some([
        this.initContentParsed !== this.$store.get('editor/content'),
        this.locale !== this.$store.get('page/locale'),
        this.path !== this.$store.get('page/path'),
        this.savedState.title !== this.$store.get('page/title'),
        this.savedState.description !== this.$store.get('page/description'),
        this.savedState.tags !== this.$store.get('page/tags'),
        this.savedState.isPublished !== this.$store.get('page/isPublished'),
        this.savedState.isTemplate !== this.$store.get('page/isTemplate'),
        this.savedState.publishStartDate !== this.$store.get('page/publishStartDate'),
        this.savedState.publishEndDate !== this.$store.get('page/publishEndDate'),
        this.savedState.css !== this.$store.get('page/scriptCss'),
        this.savedState.js !== this.$store.get('page/scriptJs')
      ], Boolean)
    }
  },
  watch: {
    currentEditor(newValue, oldValue) {
      if (newValue !== '' && this.mode === 'create') {
        _.delay(() => {
          this.dialogProps = true
        }, 500)
      }
    },
    currentStyling(newValue) {
      this.injectCustomCss(newValue)
    }
  },
  created() {
    this.$store.set('page/id', this.pageId)
    this.$store.set('page/description', this.description)
    this.$store.set('page/isPublished', this.isPublished)
    this.$store.set('page/isTemplate', this.isTemplate)
    this.$store.set('page/publishStartDate', this.publishStartDate)
    this.$store.set('page/publishEndDate', this.publishEndDate)
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/tags', this.tags)
    this.$store.set('page/title', this.title)
    this.$store.set('page/scriptCss', this.scriptCss)
    this.$store.set('page/scriptJs', this.scriptJs)

    this.$store.set('page/mode', 'edit')

    this.setCurrentSavedState()

    this.checkoutDateActive = this.checkoutDate

    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
  },
  mounted() {
    this.$store.set('editor/mode', this.initMode || 'create')

    this.initContentParsed = this.initContent ? Base64.decode(this.initContent) : ''
    this.$store.set('editor/content', this.initContentParsed)
    if (this.mode === 'create' && !this.initEditor) {
      _.delay(() => {
        this.dialogEditorSelector = true
      }, 500)
    } else {
      this.currentEditor = `editor${_.startCase(this.initEditor || 'markdown')}`
    }

    window.onbeforeunload = () => {
      if (!this.exitConfirmed && this.initContentParsed !== this.$store.get('editor/content')) {
        return this.$t('editor:unsavedWarning')
      } else {
        return undefined
      }
    }

    this.$root.$on('resetEditorConflict', () => {
      this.isConflict = false
    })

    // -> Check for an unsaved draft + start autosave
    this.lastDraftContent = this.initContentParsed
    this.checkForDraft()
    this.draftAutosaveHandle = setInterval(() => {
      this.saveDraftSilent()
    }, 30000)
  },
  beforeDestroy () {
    if (this.draftAutosaveHandle) {
      clearInterval(this.draftAutosaveHandle)
    }
  },
  methods: {
    openPropsModal(name) {
      this.dialogProps = true
    },
    showProgressDialog(textKey) {
      this.dialogProgress = true
    },
    hideProgressDialog() {
      this.dialogProgress = false
    },
    openConflict() {
      this.$root.$emit('saveConflict')
    },
    async save({ rethrow = false, overwrite = false } = {}) {
      this.showProgressDialog('saving')
      this.isSaving = true

      const saveTimeoutHandle = setTimeout(() => {
        throw new Error('Save operation timed out.')
      }, 30000)

      try {
        if (this.$store.get('editor/mode') === 'create') {
          // --------------------------------------------
          // -> CREATE PAGE
          // --------------------------------------------

          let resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $content: String!
                $description: String!
                $editor: String!
                $isPrivate: Boolean!
                $isPublished: Boolean!
                $isTemplate: Boolean
                $locale: String!
                $path: String!
                $publishEndDate: Date
                $publishStartDate: Date
                $scriptCss: String
                $scriptJs: String
                $tags: [String]!
                $title: String!
              ) {
                pages {
                  create(
                    content: $content
                    description: $description
                    editor: $editor
                    isPrivate: $isPrivate
                    isPublished: $isPublished
                    isTemplate: $isTemplate
                    locale: $locale
                    path: $path
                    publishEndDate: $publishEndDate
                    publishStartDate: $publishStartDate
                    scriptCss: $scriptCss
                    scriptJs: $scriptJs
                    tags: $tags
                    title: $title
                  ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    page {
                      id
                      updatedAt
                    }
                  }
                }
              }
            `,
            variables: {
              content: this.$store.get('editor/content'),
              description: this.$store.get('page/description'),
              editor: this.$store.get('editor/editorKey'),
              locale: this.$store.get('page/locale'),
              isPrivate: false,
              isPublished: this.$store.get('page/isPublished'),
              isTemplate: this.$store.get('page/isTemplate'),
              path: this.$store.get('page/path'),
              publishEndDate: this.$store.get('page/publishEndDate') || '',
              publishStartDate: this.$store.get('page/publishStartDate') || '',
              scriptCss: this.$store.get('page/scriptCss'),
              scriptJs: this.$store.get('page/scriptJs'),
              tags: this.$store.get('page/tags'),
              title: this.$store.get('page/title')
            }
          })
          resp = _.get(resp, 'data.pages.create', {})
          if (_.get(resp, 'responseResult.succeeded')) {
            this.checkoutDateActive = _.get(resp, 'page.updatedAt', this.checkoutDateActive)
            this.isConflict = false
            this.$store.commit('showNotification', {
              message: this.$t('editor:save.createSuccess'),
              style: 'success',
              icon: 'check'
            })
            this.$store.set('editor/id', _.get(resp, 'page.id'))
            this.$store.set('editor/mode', 'update')
            this.exitConfirmed = true
            await this.discardDraftAction()
            window.location.assign(`/${this.$store.get('page/locale')}/${this.$store.get('page/path')}`)
          } else {
            throw new Error(_.get(resp, 'responseResult.message'))
          }
        } else {
          // --------------------------------------------
          // -> UPDATE EXISTING PAGE
          // --------------------------------------------

          const conflictResp = await this.$apollo.query({
            query: gql`
              query ($id: Int!, $checkoutDate: Date!) {
                pages {
                  checkConflicts(id: $id, checkoutDate: $checkoutDate)
                }
              }
            `,
            fetchPolicy: 'network-only',
            variables: {
              id: this.pageId,
              checkoutDate: this.checkoutDateActive
            }
          })
          if (_.get(conflictResp, 'data.pages.checkConflicts', false)) {
            this.$root.$emit('saveConflict')
            throw new Error(this.$t('editor:conflict.warning'))
          }

          let resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $id: Int!
                $content: String
                $description: String
                $editor: String
                $isPrivate: Boolean
                $isPublished: Boolean
                $isTemplate: Boolean
                $locale: String
                $path: String
                $publishEndDate: Date
                $publishStartDate: Date
                $scriptCss: String
                $scriptJs: String
                $tags: [String]
                $title: String
              ) {
                pages {
                  update(
                    id: $id
                    content: $content
                    description: $description
                    editor: $editor
                    isPrivate: $isPrivate
                    isPublished: $isPublished
                    isTemplate: $isTemplate
                    locale: $locale
                    path: $path
                    publishEndDate: $publishEndDate
                    publishStartDate: $publishStartDate
                    scriptCss: $scriptCss
                    scriptJs: $scriptJs
                    tags: $tags
                    title: $title
                  ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    page {
                      updatedAt
                    }
                  }
                }
              }
            `,
            variables: {
              id: this.$store.get('page/id'),
              content: this.$store.get('editor/content'),
              description: this.$store.get('page/description'),
              editor: this.$store.get('editor/editorKey'),
              locale: this.$store.get('page/locale'),
              isPrivate: false,
              isPublished: this.$store.get('page/isPublished'),
              isTemplate: this.$store.get('page/isTemplate'),
              path: this.$store.get('page/path'),
              publishEndDate: this.$store.get('page/publishEndDate') || '',
              publishStartDate: this.$store.get('page/publishStartDate') || '',
              scriptCss: this.$store.get('page/scriptCss'),
              scriptJs: this.$store.get('page/scriptJs'),
              tags: this.$store.get('page/tags'),
              title: this.$store.get('page/title')
            }
          })
          resp = _.get(resp, 'data.pages.update', {})
          if (_.get(resp, 'responseResult.succeeded')) {
            this.checkoutDateActive = _.get(resp, 'page.updatedAt', this.checkoutDateActive)
            this.isConflict = false
            this.$store.commit('showNotification', {
              message: this.$t('editor:save.updateSuccess'),
              style: 'success',
              icon: 'check'
            })
            if (this.locale !== this.$store.get('page/locale') || this.path !== this.$store.get('page/path')) {
              _.delay(() => {
                window.location.replace(`/e/${this.$store.get('page/locale')}/${this.$store.get('page/path')}`)
              }, 1000)
            }
          } else {
            throw new Error(_.get(resp, 'responseResult.message'))
          }
        }

        this.initContentParsed = this.$store.get('editor/content')
        this.lastDraftContent = this.initContentParsed
        this.setCurrentSavedState()
        this.discardDraftAction()
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
        if (rethrow === true) {
          clearTimeout(saveTimeoutHandle)
          this.isSaving = false
          this.hideProgressDialog()
          throw err
        }
      }
      clearTimeout(saveTimeoutHandle)
      this.isSaving = false
      this.hideProgressDialog()
    },
    async saveAndClose() {
      try {
        if (this.$store.get('editor/mode') === 'create') {
          await this.save()
        } else {
          await this.save({ rethrow: true })
          await this.exit()
        }
      } catch (err) {
        // Error is already handled
      }
    },
    async exit() {
      if (this.isDirty) {
        this.dialogUnsaved = true
      } else {
        this.exitGo()
      }
    },
    exitGo() {
      this.$store.commit(`loadingStart`, 'editor-close')
      this.currentEditor = ''
      this.exitConfirmed = true
      _.delay(() => {
        if (this.$store.get('editor/mode') === 'create') {
          window.location.assign(`/`)
        } else {
          window.location.assign(`/${this.$store.get('page/locale')}/${this.$store.get('page/path')}`)
        }
      }, 500)
    },
    setCurrentSavedState () {
      this.savedState = {
        description: this.$store.get('page/description'),
        isPublished: this.$store.get('page/isPublished'),
        isTemplate: this.$store.get('page/isTemplate'),
        publishEndDate: this.$store.get('page/publishEndDate') || '',
        publishStartDate: this.$store.get('page/publishStartDate') || '',
        tags: this.$store.get('page/tags'),
        title: this.$store.get('page/title'),
        css: this.$store.get('page/scriptCss'),
        js: this.$store.get('page/scriptJs')
      }
    },
    async checkForDraft () {
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query ($path: String!, $locale: String!) {
              pages {
                draft(path: $path, locale: $locale) {
                  id
                  title
                  description
                  content
                  editor
                  updatedAt
                }
              }
            }
          `,
          fetchPolicy: 'network-only',
          variables: {
            path: this.path,
            locale: this.locale
          }
        })
        const draft = _.get(resp, 'data.pages.draft', null)
        if (draft && draft.content && draft.content !== this.initContentParsed &&
          (this.mode === 'create' || new Date(draft.updatedAt) > new Date(this.checkoutDate))) {
          this.draftFound = draft
          this.draftBannerShown = true
        }
      } catch (err) {
        console.warn('Could not check for existing draft:', err.message)
      }
    },
    restoreDraft () {
      if (!this.draftFound) { return }
      this.$store.set('editor/content', this.draftFound.content)
      if (this.draftFound.title) {
        this.$store.set('page/title', this.draftFound.title)
      }
      if (this.draftFound.description) {
        this.$store.set('page/description', this.draftFound.description)
      }
      if (this.mode === 'create' && this.draftFound.editor) {
        this.dialogEditorSelector = false
        this.currentEditor = `editor${_.startCase(this.draftFound.editor)}`
      }
      this.lastDraftContent = this.draftFound.content
      this.$root.$emit('overwriteEditorContent')
      this.draftBannerShown = false
    },
    async discardDraftAction () {
      this.draftBannerShown = false
      this.draftFound = null
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation ($path: String!, $locale: String!) {
              pages {
                discardDraft(path: $path, locale: $locale) {
                  responseResult { succeeded }
                }
              }
            }
          `,
          variables: {
            path: this.path,
            locale: this.locale
          }
        })
      } catch (err) {
        console.warn('Could not discard draft:', err.message)
      }
    },
    async saveDraftSilent () {
      if (this.isSaving || this.draftBannerShown) { return }
      const content = this.$store.get('editor/content')
      const editorKey = this.$store.get('editor/editorKey')
      if (!content || !editorKey || content === this.lastDraftContent) { return }
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation ($pageId: Int, $path: String!, $locale: String!, $title: String!, $description: String, $content: String!, $editor: String!) {
              pages {
                saveDraft(pageId: $pageId, path: $path, locale: $locale, title: $title, description: $description, content: $content, editor: $editor) {
                  responseResult { succeeded }
                }
              }
            }
          `,
          variables: {
            pageId: this.pageId > 0 ? this.pageId : null,
            path: this.path,
            locale: this.locale,
            title: this.$store.get('page/title') || '',
            description: this.$store.get('page/description') || '',
            content,
            editor: editorKey
          }
        })
        this.lastDraftContent = content
      } catch (err) {
        console.warn('Draft autosave failed:', err.message)
      }
    },
    injectCustomCss: _.debounce(css => {
      const oldStyl = document.querySelector('#editor-script-css')
      if (oldStyl) {
        document.head.removeChild(oldStyl)
      }
      if (!_.isEmpty(css)) {
        const styl = document.createElement('style')
        styl.type = 'text/css'
        styl.id = 'editor-script-css'
        document.head.appendChild(styl)
        styl.appendChild(document.createTextNode(css))
      }
    }, 1000)
  },
  apollo: {
    isConflict: {
      query: gql`
        query ($id: Int!, $checkoutDate: Date!) {
          pages {
            checkConflicts(id: $id, checkoutDate: $checkoutDate)
          }
        }
      `,
      fetchPolicy: 'network-only',
      pollInterval: 5000,
      variables () {
        return {
          id: this.pageId,
          checkoutDate: this.checkoutDateActive
        }
      },
      update: (data) => _.cloneDeep(data.pages.checkConflicts),
      skip () {
        return this.mode === 'create' || this.isSaving || !this.isDirty
      }
    }
  }
}
</script>

<style lang='scss'>

  .editor {
    background-color: mc('grey', '900') !important;
    min-height: 100vh;

    .application--wrap {
      background-color: mc('grey', '900');
    }

    &-title-input input {
      text-align: center;
    }
  }

  .atom-spinner.is-inline {
    display: inline-block;
  }

</style>
