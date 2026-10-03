const notifications = require('../../helpers/notifications')

const event = (pageId, path, extra = {}) => ({ id: pageId * 10, pageId, localeCode: 'en', path, title: path, action: 'updated', authorName: 'Ann', createdAt: '2026-10-01T10:00:00.000Z', ...extra })

describe('helpers/notifications/matchesWatch', () => {
  it('matches page watches by page ID (survives moves)', () => {
    expect(notifications.matchesWatch({ kind: 'page', pageId: 5 }, event(5, 'renamed/page'))).toBe(true)
    expect(notifications.matchesWatch({ kind: 'page', pageId: 5 }, event(6, 'docs'))).toBe(false)
  })

  it('matches path watches for the page itself and its subpages only', () => {
    const watch = { kind: 'path', localeCode: 'en', path: 'docs' }
    expect(notifications.matchesWatch(watch, event(1, 'docs'))).toBe(true)
    expect(notifications.matchesWatch(watch, event(1, 'docs/setup/linux'))).toBe(true)
    expect(notifications.matchesWatch(watch, event(1, 'docsearch'))).toBe(false)
    expect(notifications.matchesWatch(watch, event(1, 'docs', { localeCode: 'de' }))).toBe(false)
  })

  it('covers the whole locale with an empty path', () => {
    expect(notifications.matchesWatch({ kind: 'path', localeCode: 'en', path: '' }, event(1, 'anything/deep'))).toBe(true)
  })

  it('matches pages moved out of a watched subtree', () => {
    const watch = { kind: 'path', localeCode: 'en', path: 'docs' }
    expect(notifications.matchesWatch(watch, event(1, 'archive/x', { action: 'moved', previousPath: 'docs/x', previousLocaleCode: 'en' }))).toBe(true)
  })
})

describe('helpers/notifications/buildDigest', () => {
  it('groups events per page, newest page first', () => {
    const digest = notifications.buildDigest([
      event(1, 'a', { createdAt: '2026-10-01T10:00:00.000Z' }),
      event(2, 'b', { createdAt: '2026-10-01T11:00:00.000Z' }),
      event(1, 'a', { id: 11, createdAt: '2026-10-01T12:00:00.000Z', action: 'deleted', authorName: 'Bob' })
    ])
    expect(digest.map(p => p.pageId)).toEqual([1, 2])
    expect(digest[0].isDeleted).toBe(true)
    expect(digest[0].changes.map(c => c.action)).toEqual(['updated', 'deleted'])
  })
})

describe('helpers/notifications/renderDigest', () => {
  const t = (key, opts) => opts.defaultValue.replace('{{count}}', opts.count)
  const pageUrl = (locale, path) => `/${locale}/${path}`

  it('escapes titles and links existing pages only', () => {
    const digest = notifications.buildDigest([
      event(1, 'docs/a', { title: '<b>A & B</b>' }),
      event(2, 'gone', { action: 'deleted' })
    ])
    const { html, text } = notifications.renderDigest(digest, { host: 'https://wiki.example.com', t, pageUrl })
    expect(html).toContain('&lt;b&gt;A &amp; B&lt;/b&gt;')
    expect(html).not.toContain('<b>A')
    expect(html).toContain('href="https://wiki.example.com/en/docs/a"')
    expect(html).not.toContain('/en/gone"')
    expect(text).toContain('https://wiki.example.com/en/docs/a')
  })

  it('caps the number of pages', () => {
    const events = []
    for (let i = 1; i <= notifications.MAX_DIGEST_PAGES + 5; i++) {
      events.push(event(i, `p${i}`))
    }
    const { html, text } = notifications.renderDigest(notifications.buildDigest(events), { host: '', t, pageUrl })
    expect(html).toContain('+5 more pages')
    expect(text.split('\n')).toHaveLength(notifications.MAX_DIGEST_PAGES + 1)
  })
})
