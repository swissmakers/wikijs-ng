import _ from 'lodash'

/* global siteLangs */

/**
 * Initials of a name: first letter of the first and the last word
 *
 * @param {string} name Full name
 * @returns {string} Up to 2 uppercase letters
 */
export function initials (name) {
  const nameParts = _.trim(name).toUpperCase().split(/\s+/).filter(p => p.length > 0)
  if (nameParts.length < 1) {
    return ''
  }
  let result = _.head(nameParts).charAt(0)
  if (nameParts.length > 1) {
    result += _.last(nameParts).charAt(0)
  }
  return result
}

/**
 * Humanized file size (decimal units, e.g. 1.5 MB)
 *
 * @param {number} num Size in bytes
 * @returns {string} Humanized size
 */
export function bytes (num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return '0 B'
  }
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  const neg = num < 0
  let size = Math.abs(num)
  if (size < 1) {
    return (neg ? '-' : '') + size + ' B'
  }
  const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1000)), units.length - 1)
  size = (size / Math.pow(1000, exponent)).toFixed(2) * 1
  return (neg ? '-' : '') + size + ' ' + units[exponent]
}

/**
 * Decode the base64 JSON effective permissions passed by the server views
 *
 * @param {string} raw Base64 encoded JSON
 * @returns {Object} Effective permissions
 */
export function decodePermissions (raw) {
  return JSON.parse(Buffer.from(raw, 'base64').toString())
}

/**
 * Absolute path of a page, prefixed with the locale when namespacing is enabled
 *
 * @param {string} locale Locale code
 * @param {string} path Page path
 * @returns {string} Absolute page path
 */
export function pagePath (locale, path) {
  return siteLangs.length > 0 ? `/${locale}/${path}` : `/${path}`
}

/**
 * All IANA time zones supported by the browser, sorted by current UTC offset
 *
 * @returns {Array<Object>} Items { text: '(GMT+01:00) Europe/Zurich', value: 'Europe/Zurich' }
 */
export function timezones () {
  let zones = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch (err) {
    zones = [Intl.DateTimeFormat().resolvedOptions().timeZone]
  }
  if (!zones.includes('UTC')) {
    zones = ['UTC', ...zones]
  }
  const now = new Date()
  return _.sortBy(zones.map(zone => {
    let offset = 'GMT+00:00'
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(now).find(p => p.type === 'timeZoneName')
      offset = (part && part.value !== 'GMT') ? part.value : 'GMT+00:00'
    } catch (err) {}
    const [, sign, hours, minutes] = offset.match(/GMT([+-])(\d{2}):(\d{2})/) || [null, '+', '00', '00']
    return {
      text: `(${offset}) ${zone.replace(/_/g, ' ')}`,
      value: zone,
      minutes: (sign === '-' ? -1 : 1) * (parseInt(hours) * 60 + parseInt(minutes))
    }
  }), ['minutes', 'value']).map(tz => ({ text: tz.text, value: tz.value }))
}
