/**
 * Global single-key shortcuts (disabled while typing, in the editor or with an open dialog)
 */

const STORAGE_KEY = 'wiki-hotkeys-disabled'

export const SHORTCUTS = [
  { key: '/', event: 'shortcutSearch', i18n: 'common:shortcuts.search', label: 'Search' },
  { key: 'e', event: 'shortcutEdit', i18n: 'common:shortcuts.edit', label: 'Edit page' },
  { key: 'h', event: 'shortcutHistory', i18n: 'common:shortcuts.history', label: 'Page history' },
  { key: 'n', event: 'shortcutNewPage', i18n: 'common:shortcuts.newPage', label: 'New page' },
  { key: 'b', event: 'pageToggleBookmark', i18n: 'common:shortcuts.bookmark', label: 'Bookmark page' },
  { key: 'w', event: 'pageWatch', i18n: 'common:shortcuts.watch', label: 'Watch page' },
  { key: 'p', event: 'pageExportPdf', i18n: 'common:shortcuts.pdf', label: 'Export as PDF' },
  { key: '?', event: 'shortcutHelp', i18n: 'common:shortcuts.help', label: 'Show keyboard shortcuts' }
]

export function isDisabled () {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch (err) {
    return false
  }
}

export function setDisabled (disabled) {
  try {
    if (disabled) {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch (err) {}
}

const isTyping = target => {
  if (!target) {
    return false
  }
  const tag = (target.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable || Boolean(target.closest && target.closest('.CodeMirror, .ck-editor'))
}

/**
 * Install the keydown handler; shortcuts are emitted on the given Vue root
 *
 * @param {Object} root Vue root instance ($root)
 * @param {Function} isActive Returns false when shortcuts must be ignored (e.g. edit mode)
 * @returns {Function} Uninstall function
 */
export function installHotkeys (root, isActive = () => true) {
  const handler = evt => {
    if (evt.defaultPrevented || evt.ctrlKey || evt.metaKey || evt.altKey || isDisabled() || !isActive()) {
      return
    }
    if (isTyping(evt.target) || document.querySelector('.v-dialog--active')) {
      return
    }
    const shortcut = SHORTCUTS.find(s => s.key === evt.key)
    if (shortcut) {
      evt.preventDefault()
      root.$emit(shortcut.event)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}
