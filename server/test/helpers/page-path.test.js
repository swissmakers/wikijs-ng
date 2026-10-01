const pageHelper = require('../../helpers/page')

describe('helpers/page paths', () => {
  beforeAll(() => {
    global.WIKI = {
      config: { lang: { code: 'en' } },
      data: { reservedPaths: ['login', 'logout', 'a', 'e', '_assets'] }
    }
  })

  afterAll(() => {
    delete global.WIKI
  })

  it('parses locale, path and extension', () => {
    expect(pageHelper.parsePath('/')).toMatchObject({ locale: 'en', path: 'home', explicitLocale: false })
    expect(pageHelper.parsePath('/de/docs/setup')).toMatchObject({ locale: 'de', path: 'docs/setup', explicitLocale: true })
    expect(pageHelper.parsePath('/docs/setup.md', { stripExt: true }).path).toBe('docs/setup')
    expect(pageHelper.parsePath('/docs/setup.md').path).toBe('docs/setup.md')
    // -> Single-letter route prefixes (e.g. /e/ for the editor) are dropped
    expect(pageHelper.parsePath('/e/fr/guide')).toMatchObject({ locale: 'fr', path: 'guide' })
  })

  it('strips unsafe segments and characters', () => {
    expect(pageHelper.parsePath('/docs/../../etc/passwd').path).toBe('docs/etc/passwd')
    expect(pageHelper.parsePath('/docs/a%3Cb%3E"c').path).toBe('docs/abc')
    expect(pageHelper.parsePath('/docs//x').path).toBe('docsx')
  })

  it('detects reserved paths', () => {
    expect(pageHelper.isReservedPath('login')).toBe(true)
    expect(pageHelper.isReservedPath('_assets/x')).toBe(true)
    expect(pageHelper.isReservedPath('de/docs')).toBe(true)
    expect(pageHelper.isReservedPath('x/docs')).toBe(true)
    expect(pageHelper.isReservedPath('docs/login')).toBe(false)
  })

  it('hashes locale, path and private namespace', () => {
    const hash = pageHelper.generateHash({ locale: 'en', path: 'docs', privateNS: '' })
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
    expect(pageHelper.generateHash({ locale: 'de', path: 'docs', privateNS: '' })).not.toBe(hash)
    expect(pageHelper.generateHash({ locale: 'en', path: 'docs', privateNS: '' })).toBe(hash)
  })
})
