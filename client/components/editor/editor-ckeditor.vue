<template lang='pug'>
  .editor-ckeditor
    div(ref='toolbarContainer')
    div.contents(ref='editor')
    v-system-bar.editor-ckeditor-sysbar(dark, status, color='grey darken-3')
      .caption.editor-ckeditor-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption Visual Editor
        v-spacer
        .caption {{$t('editor:ckeditor.stats', { chars: stats.characters, words: stats.words })}}
    editor-conflict(v-model='isConflict', v-if='isConflict')
    page-selector(mode='select', v-model='insertLinkDialog', :open-handler='insertLinkHandler', :path='path', :locale='locale')
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import {
  DecoupledEditor, Plugin, ButtonView, IconBrowseFiles, IconDocument,
  Essentials, Paragraph, Heading, Autoformat, TextTransformation, PasteFromOffice, WordCount,
  Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, Highlight, RemoveFormat,
  FontSize, FontFamily, Alignment, List, TodoList, SpecialCharacters, SpecialCharactersEssentials,
  Link, BlockQuote, CodeBlock, HorizontalLine, MediaEmbed,
  Table, TableToolbar, TableProperties, TableCellProperties,
  Image, ImageCaption, ImageStyle, ImageToolbar, ImageResize, ImageTextAlternative
} from 'ckeditor5'
import 'ckeditor5/ckeditor5.css'
import EditorConflict from './ckeditor/conflict.vue'
import { html as beautify } from 'js-beautify/js/lib/beautifier.min.js'
import { pagePath } from '@/helpers'

/**
 * Wiki.js toolbar buttons: insert assets from the media manager, link to a wiki page
 */
class WikiTools extends Plugin {
  static get pluginName () {
    return 'WikiTools'
  }

  init () {
    const editor = this.editor
    const addButton = (name, icon, label, onExecute) => {
      editor.ui.componentFactory.add(name, locale => {
        const button = new ButtonView(locale)
        button.set({ label, icon, tooltip: true })
        button.on('execute', () => onExecute())
        return button
      })
    }
    const wiki = editor.config.get('wiki')
    addButton('insertAsset', IconBrowseFiles, wiki.labels.insertAsset, wiki.onInsertAsset)
    addButton('linkToPage', IconDocument, wiki.labels.linkToPage, wiki.onLinkToPage)
  }
}

/**
 * UI translations of the editor (lazy loaded, English is built in)
 */
async function loadTranslations (locale) {
  const lang = _.toLower(locale)
  if (!lang || lang === 'en') {
    return []
  }
  try {
    const translations = await import(/* webpackChunkName: "ckeditor5-i18n-[request]", webpackInclude: /[\\/][a-z]{2}(-[a-z]+)?\.js$/ */ `ckeditor5-translations/${lang}.js`)
    return [translations.default]
  } catch (err) {
    return []
  }
}

export default {
  components: {
    EditorConflict
  },
  props: {
    save: {
      type: Function,
      default: () => {}
    }
  },
  data () {
    return {
      editor: null,
      stats: {
        characters: 0,
        words: 0
      },
      content: '',
      isConflict: false,
      insertLinkDialog: false
    }
  },
  computed: {
    isMobile () {
      return this.$vuetify.breakpoint.smAndDown
    },
    locale: get('page/locale'),
    path: get('page/path'),
    activeModal: sync('editor/activeModal')
  },
  methods: {
    insertLink () {
      this.insertLinkDialog = true
    },
    insertLinkHandler ({ locale, path }) {
      this.editor.execute('link', pagePath(locale, path))
    }
  },
  async mounted () {
    this.$store.set('editor/editorKey', 'ckeditor')

    const translations = await loadTranslations(this.locale)
    this.editor = await DecoupledEditor.create(this.$refs.editor, {
      // -> CKEditor 5 is used under the GPL (the wiki is AGPL-3.0); no license server is contacted
      licenseKey: 'GPL',
      plugins: [
        Essentials, Paragraph, Heading, Autoformat, TextTransformation, PasteFromOffice, WordCount,
        Bold, Italic, Underline, Strikethrough, Subscript, Superscript, Code, Highlight, RemoveFormat,
        FontSize, FontFamily, Alignment, List, TodoList, SpecialCharacters, SpecialCharactersEssentials,
        Link, BlockQuote, CodeBlock, HorizontalLine, MediaEmbed,
        Table, TableToolbar, TableProperties, TableCellProperties,
        Image, ImageCaption, ImageStyle, ImageToolbar, ImageResize, ImageTextAlternative,
        WikiTools
      ],
      toolbar: {
        items: [
          'heading', '|', 'fontSize', 'fontFamily', '|',
          'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'highlight', '|',
          'alignment', '|', 'numberedList', 'bulletedList', 'todoList', '|',
          'specialCharacters', 'linkToPage', 'link', 'blockQuote', 'insertAsset', 'insertTable', 'code', 'codeBlock', 'mediaEmbed', 'horizontalLine', '|',
          'removeFormat', '|', 'undo', 'redo'
        ],
        shouldNotGroupWhenFull: false
      },
      heading: {
        options: [
          { model: 'paragraph', title: 'Paragraph', class: '' },
          ..._.range(1, 7).map(level => ({ model: `heading${level}`, view: `h${level}`, title: `Heading ${level}`, class: '' }))
        ]
      },
      image: {
        toolbar: ['imageStyle:alignLeft', 'imageStyle:block', 'imageStyle:alignRight', '|', 'toggleImageCaption', 'imageTextAlternative']
      },
      table: {
        contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableCellProperties', 'tableProperties']
      },
      link: {
        decorators: {
          isDownloadable: {
            mode: 'manual',
            label: 'Downloadable',
            attributes: { download: '' }
          }
        }
      },
      language: this.locale,
      // -> Only when there is one: CKEditor fails on an empty translations list (e.g. English)
      ...translations.length > 0 && { translations },
      placeholder: 'Type the page content here',
      wordCount: {
        onUpdate: stats => {
          this.stats = {
            characters: stats.characters,
            words: stats.words
          }
        }
      },
      wiki: {
        labels: {
          insertAsset: this.$t('editor:markup.insertAssets', { defaultValue: 'Insert Assets' }),
          linkToPage: this.$t('editor:ckeditor.linkToPage', { defaultValue: 'Link to Page' })
        },
        onInsertAsset: () => {
          this.activeModal = 'editorModalMedia'
        },
        onLinkToPage: () => {
          this.insertLink()
        }
      }
    })
    this.$refs.toolbarContainer.appendChild(this.editor.ui.view.toolbar.element)

    // -> Existing content, or the template / version a new page starts from
    this.editor.setData(this.$store.get('editor/content') || '')

    this.editor.model.document.on('change:data', _.debounce(evt => {
      this.$store.set('editor/content', beautify(this.editor.getData(), { indent_size: 2, end_with_newline: true }))
    }, 300))

    this.$root.$on('editorInsert', opts => {
      switch (opts.kind) {
        case 'IMAGE':
          this.editor.execute('insertImage', {
            source: opts.path
          })
          break
        case 'BINARY':
          this.editor.execute('link', opts.path, {
            linkIsDownloadable: true
          })
          break
        case 'DIAGRAM':
          this.editor.execute('insertImage', {
            source: `data:image/svg+xml;base64,${opts.text}`
          })
          break
      }
    })

    this.$root.$on('editorLinkToPage', opts => {
      this.insertLink()
    })

    // Handle save conflict
    this.$root.$on('saveConflict', () => {
      this.isConflict = true
    })
    this.$root.$on('overwriteEditorContent', () => {
      this.editor.setData(this.$store.get('editor/content'))
    })
  },
  beforeDestroy () {
    if (this.editor) {
      this.editor.destroy()
      this.editor = null
    }
  }
}
</script>

<style lang="scss">

$editor-height: calc(100vh - 64px - 24px);
$editor-height-mobile: calc(100vh - 56px - 16px);

.editor-ckeditor {
  background-color: mc('grey', '200');
  flex: 1 1 50%;
  display: flex;
  flex-flow: column nowrap;
  height: $editor-height;
  max-height: $editor-height;
  position: relative;

  @at-root .theme--dark & {
    background-color: mc('grey', '900');
  }

  @include until($tablet) {
    height: $editor-height-mobile;
    max-height: $editor-height-mobile;
  }

  &-sysbar {
    padding-left: 0;

    &-locale {
      background-color: rgba(255,255,255,.25);
      display:inline-flex;
      padding: 0 12px;
      height: 24px;
      width: 63px;
      justify-content: center;
      align-items: center;
    }
  }

  // -> More specific than the page view's `.theme--dark .v-main .contents code` (the editable also has .contents)
  .contents.ck-editor__editable {
    table {
      margin: inherit;
    }
    pre > code {
      background-color: unset;
      color: unset;
      padding: .15em;
    }
  }

  .ck.ck-toolbar {
    border: none;
    justify-content: center;
    background-color: mc('grey', '300');
    color: #FFF;
  }

  .ck.ck-toolbar__items {
    justify-content: center;
  }

  > .ck-editor__editable {
    background-color: mc('grey', '100');
    overflow-y: auto;
    overflow-x: hidden;
    padding: 2rem;
    box-shadow: 0 0 5px rgba(0, 0, 0, .1);
    margin: 1rem auto 0;
    width: calc(100vw - 256px - 16vw);
    min-height: calc(100vh - 64px - 24px - 1rem - 40px);
    border-radius: 5px;

    @at-root .theme--dark & {
      background-color: #303030;
      color: #FFF;
    }

    @include until($widescreen) {
      width: calc(100vw - 2rem);
      margin: 1rem 1rem 0 1rem;
      min-height: calc(100vh - 64px - 24px - 1rem - 40px);
    }

    @include until($tablet) {
      width: 100%;
      margin: 0;
      min-height: calc(100vh - 56px - 24px - 76px);
    }

    &.ck.ck-editor__editable:not(.ck-editor__nested-editable).ck-focused {
      border-color: #FFF;
      box-shadow: 0 0 10px rgba(mc('blue', '700'), .25);

      @at-root .theme--dark & {
        border-color: #444;
        border-bottom: none;
        box-shadow: 0 0 10px rgba(#000, .25);
      }
    }

    &.ck .ck-editor__nested-editable.ck-editor__nested-editable_focused,
    &.ck .ck-editor__nested-editable:focus,
    .ck-widget.table td.ck-editor__nested-editable.ck-editor__nested-editable_focused,
    .ck-widget.table th.ck-editor__nested-editable.ck-editor__nested-editable_focused {
      background-color: mc('grey', '100');

      @at-root .theme--dark & {
        background-color: mc('grey', '900');
      }
    }
  }
}
</style>
