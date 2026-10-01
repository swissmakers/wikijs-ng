const _ = require('lodash')

/* global WIKI */

const MAX_DIGEST_PAGES = 100

/**
 * Does a path watch cover the given location? An empty watch path covers the whole locale.
 */
const pathCovered = (watch, localeCode, path) => {
  if (!path || localeCode !== watch.localeCode) {
    return false
  }
  return watch.path === '' || path === watch.path || _.startsWith(path, `${watch.path}/`)
}

module.exports = {
  MAX_DIGEST_PAGES,
  /**
   * Can the user see an activity event? Unpublished pages and templates are only
   * shown to users who can edit them. Tags are only known for pages that still exist.
   *
   * @param {Object} user User (JWT user or model with groups)
   * @param {Object} event Activity event ({ path, localeCode, isPublished, isTemplate })
   * @param {Array} tags Page tags
   * @returns {Boolean}
   */
  canSeeEvent (user, event, tags = []) {
    const pageCtx = { path: event.path, locale: event.localeCode, tags }
    if (!WIKI.auth.checkAccess(user, ['read:pages'], pageCtx)) {
      return false
    }
    if (!event.isPublished || event.isTemplate) {
      return WIKI.auth.checkAccess(user, ['write:pages'], pageCtx)
    }
    return true
  },
  /**
   * Does a watch cover an activity event?
   * Page watches follow the page (by ID), path watches cover the page and its subpages,
   * including pages moved into or out of the watched subtree.
   *
   * @param {Object} watch Watch ({ kind, pageId, localeCode, path })
   * @param {Object} event Activity event ({ pageId, localeCode, path, previousLocaleCode, previousPath })
   * @returns {Boolean}
   */
  matchesWatch (watch, event) {
    if (watch.kind === 'page') {
      return watch.pageId === event.pageId
    } else if (watch.kind === 'path') {
      return pathCovered(watch, event.localeCode, event.path) ||
        pathCovered(watch, event.previousLocaleCode || event.localeCode, event.previousPath)
    }
    return false
  },
  /**
   * Group the activity events of one recipient by page
   *
   * @param {Array<Object>} events Activity events, oldest first
   * @returns {Array<Object>} Pages ({ pageId, localeCode, path, title, isDeleted, lastAt, changes }) most recent first
   */
  buildDigest (events) {
    const pages = _.map(_.groupBy(events, 'pageId'), pageEvents => {
      const sorted = _.sortBy(pageEvents, ['createdAt', 'id'])
      const last = _.last(sorted)
      return {
        pageId: last.pageId,
        localeCode: last.localeCode,
        path: last.path,
        title: last.title || last.path,
        isDeleted: last.action === 'deleted',
        lastAt: last.createdAt,
        changes: sorted.map(e => ({
          action: e.action,
          authorName: e.authorName,
          createdAt: e.createdAt,
          previousPath: e.previousPath
        }))
      }
    })
    return _.orderBy(pages, ['lastAt'], ['desc'])
  },
  /**
   * Render a digest as HTML (for the mail template) and plain text
   *
   * @param {Array<Object>} digest Result of buildDigest
   * @param {Object} opts Options
   * @param {string} opts.host Site URL
   * @param {Function} opts.t Translate function (key, options) => string
   * @param {Function} opts.pageUrl (localeCode, path) => absolute page path
   * @returns {Object} { html, text }
   */
  renderDigest (digest, { host, t, pageUrl }) {
    const shown = _.take(digest, MAX_DIGEST_PAGES)
    const actionLabel = change => {
      const label = t(`common:notifications.action.${change.action}`, { defaultValue: change.action })
      return change.action === 'moved' && change.previousPath ? `${label} (/${change.previousPath})` : label
    }
    const summary = page => _.uniqBy(page.changes, c => `${c.action}|${c.authorName}`)
      .map(c => `${actionLabel(c)} – ${c.authorName || '?'}`)
      .join(', ')

    const html = shown.map(page => {
      const title = _.escape(page.title)
      const link = page.isDeleted ? title : `<a href="${_.escape(host + pageUrl(page.localeCode, page.path))}" style="color: #2A5BD6;">${title}</a>`
      return `<li style="margin-bottom: 8px;"><strong>${link}</strong><br><span style="color: #666666; font-size: 13px;">/${_.escape(page.path)} · ${_.escape(summary(page))}</span></li>`
    })
    const text = shown.map(page => `- ${page.title} (${page.isDeleted ? '' : host}${page.isDeleted ? '/' + page.path : pageUrl(page.localeCode, page.path)}): ${summary(page)}`)
    if (digest.length > shown.length) {
      const more = t('common:notifications.more', { count: digest.length - shown.length, defaultValue: '+{{count}} more pages' })
      html.push(`<li>${_.escape(more)}</li>`)
      text.push(more)
    }
    return {
      html: `<ul style="margin: 0; padding-left: 20px;">${html.join('')}</ul>`,
      text: text.join('\n')
    }
  }
}
