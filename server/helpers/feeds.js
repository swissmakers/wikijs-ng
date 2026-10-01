const _ = require('lodash')

const escapeXml = str => _.toString(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

module.exports = {
  escapeXml,
  /**
   * Is a page publicly listed: published (within its publishing window), not private, not a template
   *
   * @param {Object} page Page ({ isPublished, isPrivate, isTemplate, publishStartDate, publishEndDate })
   * @param {Date} [now] Current date
   * @returns {Boolean}
   */
  isPubliclyVisible (page, now = new Date()) {
    if (!page.isPublished || page.isPrivate || page.isTemplate) {
      return false
    }
    if (!_.isEmpty(page.publishStartDate) && !(new Date(page.publishStartDate) <= now)) {
      return false
    }
    if (!_.isEmpty(page.publishEndDate) && !(new Date(page.publishEndDate) >= now)) {
      return false
    }
    return true
  },
  /**
   * XML sitemap (https://www.sitemaps.org/protocol.html)
   *
   * @param {Array<Object>} pages Pages ({ localeCode, path, updatedAt })
   * @param {Object} opts Options ({ host, pageUrl: (locale, path) => absolute path })
   * @returns {string} XML
   */
  sitemapXml (pages, { host, pageUrl }) {
    const urls = pages.map(page => {
      const lastmod = page.updatedAt ? `<lastmod>${escapeXml(new Date(page.updatedAt).toISOString())}</lastmod>` : ''
      return `<url><loc>${escapeXml(host + pageUrl(page.localeCode, page.path))}</loc>${lastmod}</url>`
    })
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  },
  /**
   * RSS 2.0 feed of recent page changes
   *
   * @param {Array<Object>} items Activity items ({ id, localeCode, path, title, action, authorName, createdAt, description })
   * @param {Object} opts Options ({ title, description, host, lang, pageUrl, actionLabel })
   * @returns {string} XML
   */
  rssXml (items, { title, description, host, lang, pageUrl, actionLabel }) {
    const entries = items.map(item => {
      const link = host + pageUrl(item.localeCode, item.path)
      const summary = `${actionLabel(item.action)} – ${item.authorName}${item.description ? `: ${item.description}` : ''}`
      return [
        '<item>',
        `<title>${escapeXml(item.title || item.path)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="false">${escapeXml(`${host}/#activity-${item.id}`)}</guid>`,
        `<pubDate>${escapeXml(new Date(item.createdAt).toUTCString())}</pubDate>`,
        `<description>${escapeXml(summary)}</description>`,
        '</item>'
      ].join('')
    })
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0"><channel>',
      `<title>${escapeXml(title)}</title>`,
      `<link>${escapeXml(host)}</link>`,
      `<description>${escapeXml(description)}</description>`,
      `<language>${escapeXml(lang)}</language>`,
      ...entries,
      '</channel></rss>',
      ''
    ].join('\n')
  }
}
