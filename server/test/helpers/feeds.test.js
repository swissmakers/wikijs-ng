const feeds = require('../../helpers/feeds')

const pageUrl = (locale, path) => `/${locale}/${path}`

describe('helpers/feeds/isPubliclyVisible', () => {
  const now = new Date('2026-10-01T12:00:00Z')
  it('requires published, non-private, non-template pages', () => {
    expect(feeds.isPubliclyVisible({ isPublished: true }, now)).toBe(true)
    expect(feeds.isPubliclyVisible({ isPublished: 0 }, now)).toBe(false)
    expect(feeds.isPubliclyVisible({ isPublished: true, isPrivate: true }, now)).toBe(false)
    expect(feeds.isPubliclyVisible({ isPublished: true, isTemplate: 1 }, now)).toBe(false)
  })

  it('respects the publishing window', () => {
    expect(feeds.isPubliclyVisible({ isPublished: true, publishStartDate: '2026-11-01' }, now)).toBe(false)
    expect(feeds.isPubliclyVisible({ isPublished: true, publishEndDate: '2026-09-01' }, now)).toBe(false)
    expect(feeds.isPubliclyVisible({ isPublished: true, publishStartDate: '2026-09-01', publishEndDate: '2026-11-01' }, now)).toBe(true)
  })
})

describe('helpers/feeds/sitemapXml', () => {
  it('lists escaped absolute URLs', () => {
    const xml = feeds.sitemapXml([{ localeCode: 'en', path: 'a&b', updatedAt: '2026-10-01T12:00:00Z' }], { host: 'https://wiki.example.com', pageUrl })
    expect(xml).toContain('<loc>https://wiki.example.com/en/a&amp;b</loc>')
    expect(xml).toContain('<lastmod>2026-10-01T12:00:00.000Z</lastmod>')
    expect(xml.startsWith('<?xml')).toBe(true)
  })
})

describe('helpers/feeds/rssXml', () => {
  it('renders escaped items', () => {
    const xml = feeds.rssXml([{ id: 7, localeCode: 'en', path: 'docs', title: '<Docs>', action: 'updated', authorName: 'Ann', createdAt: '2026-10-01T12:00:00Z' }], {
      title: 'Wiki',
      description: 'Recent changes',
      host: 'https://wiki.example.com',
      lang: 'en',
      pageUrl,
      actionLabel: a => a
    })
    expect(xml).toContain('<title>&lt;Docs&gt;</title>')
    expect(xml).toContain('<link>https://wiki.example.com/en/docs</link>')
    expect(xml).toContain('<description>updated – Ann</description>')
    expect(xml).toContain('<pubDate>Thu, 01 Oct 2026 12:00:00 GMT</pubDate>')
  })
})
