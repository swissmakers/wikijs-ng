/* global siteConfig */

const MEDIA_QUERY = '(prefers-color-scheme: dark)'
const GUEST_STORAGE_KEY = 'wiki-appearance'

/**
 * Appearance values: '' (site default), 'light', 'dark', 'system' (follows the OS / browser)
 */
export const APPEARANCES = ['', 'light', 'dark', 'system']

let current = ''
let mediaQuery = null

function systemPrefersDark () {
  return Boolean(mediaQuery && mediaQuery.matches)
}

function setTheme (dark) {
  if (window.WIKI && window.WIKI.$vuetify) {
    window.WIKI.$vuetify.theme.dark = dark
  }
}

/**
 * Resolve an appearance value to dark / light
 *
 * @param {string} appearance Appearance value
 * @returns {boolean} Dark mode
 */
export function isDark (appearance) {
  switch (appearance) {
    case 'dark':
      return true
    case 'light':
      return false
    case 'system':
      return systemPrefersDark()
    default:
      return Boolean(siteConfig.darkMode)
  }
}

/**
 * Appearance chosen by a guest on this browser
 */
export function getGuestAppearance () {
  try {
    const value = window.localStorage.getItem(GUEST_STORAGE_KEY)
    return APPEARANCES.includes(value) ? value : ''
  } catch (err) {
    return ''
  }
}

export function setGuestAppearance (value) {
  try {
    if (value) {
      window.localStorage.setItem(GUEST_STORAGE_KEY, value)
    } else {
      window.localStorage.removeItem(GUEST_STORAGE_KEY)
    }
  } catch (err) {}
}

/**
 * Set up appearance tracking (call once, before Vuetify is created)
 *
 * @param {string} appearance Initial appearance value
 * @returns {boolean} Initial dark mode
 */
export function initAppearance (appearance) {
  current = appearance || ''
  if (!mediaQuery && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia(MEDIA_QUERY)
    const onChange = () => {
      if (current === 'system') {
        setTheme(systemPrefersDark())
      }
    }
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(onChange)
    }
  }
  return isDark(current)
}

/**
 * Apply an appearance value to the UI
 *
 * @param {string} appearance Appearance value
 */
export function applyAppearance (appearance) {
  current = appearance || ''
  setTheme(isDark(current))
}

export function currentAppearance () {
  return current
}
