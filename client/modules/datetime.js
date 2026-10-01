import _ from 'lodash'
import { DateTime, Duration, Settings } from 'luxon'

// User date formats are stored with the tokens of the former moment.js library
const DATE_FORMATS = {
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'DD.MM.YYYY': 'dd.MM.yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'YYYY/MM/DD': 'yyyy/MM/dd'
}

const DATE_LONG = { year: 'numeric', month: 'long', day: 'numeric' }
const TIME = { hour: 'numeric', minute: '2-digit' }

const state = {
  dateFormat: ''
}

const toDateTime = value => {
  if (!value) {
    return null
  }
  let dt
  if (value instanceof Date) {
    dt = DateTime.fromJSDate(value)
  } else if (_.isNumber(value)) {
    dt = DateTime.fromMillis(value)
  } else {
    dt = DateTime.fromISO(value)
    if (!dt.isValid) {
      dt = DateTime.fromJSDate(new Date(value))
    }
  }
  return dt.isValid ? dt : null
}

const shortDate = dt => state.dateFormat ? dt.toFormat(state.dateFormat) : dt.toLocaleString(DateTime.DATE_SHORT)

/**
 * Relative day for recent dates ("Today, 14:30", "Monday, 09:12"), the short date otherwise
 */
const calendar = dt => {
  const days = Math.round(dt.startOf('day').diff(DateTime.now().startOf('day'), 'days').days)
  const time = dt.toLocaleString(TIME)
  if (Math.abs(days) <= 1) {
    return `${_.upperFirst(dt.toRelativeCalendar({ unit: 'days' }))}, ${time}`
  } else if (days < 0 && days > -7) {
    return `${dt.toLocaleString({ weekday: 'long' })}, ${time}`
  }
  return shortDate(dt)
}

export default {
  setLocale (locale) {
    Settings.defaultLocale = locale || 'en'
  },
  setZone (zone) {
    Settings.defaultZone = zone || 'system'
  },
  setDateFormat (format) {
    state.dateFormat = DATE_FORMATS[format] || ''
  },
  /**
   * Format a date (ISO string, Date or timestamp)
   *
   * @param {*} value Date value
   * @param {string} format calendar, from, L, ll, LL, lll, LLL or LLLL
   * @returns {string} Formatted date, '' for empty / invalid values
   */
  formatDate (value, format = 'LLL') {
    const dt = toDateTime(value)
    if (!dt) {
      return ''
    }
    switch (format) {
      case 'from':
        return dt.toRelative()
      case 'calendar':
        return calendar(dt)
      case 'L':
        return shortDate(dt)
      case 'll':
        return dt.toLocaleString(DateTime.DATE_MED)
      case 'LL':
        return dt.toLocaleString(DATE_LONG)
      case 'lll':
        return dt.toLocaleString(DateTime.DATETIME_MED)
      case 'LLLL':
        return dt.toLocaleString({ weekday: 'long', ...DATE_LONG, ...TIME })
      default:
        return dt.toLocaleString({ ...DATE_LONG, ...TIME })
    }
  },
  /**
   * Parse an ISO 8601 duration, normalized to years / months / days / hours / minutes
   *
   * @param {string} value ISO 8601 duration (e.g. PT5M)
   * @returns {Duration} Luxon duration (0 if invalid)
   */
  parseDuration (value) {
    const duration = Duration.fromISO(value || 'PT0S')
    return (duration.isValid ? duration : Duration.fromMillis(0)).shiftTo('years', 'months', 'days', 'hours', 'minutes')
  },
  /**
   * Human readable duration without zero units, e.g. "1 day, 2 hours"
   *
   * @param {string} value ISO 8601 duration
   * @returns {string} Localized duration
   */
  humanizeDuration (value) {
    const units = _.pickBy(this.parseDuration(value).toObject(), v => v > 0)
    return _.isEmpty(units) ? '0' : Duration.fromObject(units).toHuman()
  }
}
