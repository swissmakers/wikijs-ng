const cfgHelper = require('../../helpers/config')

describe('helpers/config/withDefaults', () => {
  const defaults = {
    pageExtensions: ['md', 'html', 'txt'],
    theming: { theme: 'default', darkMode: false, tocPosition: 'left' },
    lang: { code: 'en', namespaces: [] }
  }

  it('fills missing settings, also in nested objects', () => {
    const merged = cfgHelper.withDefaults({ theming: { darkMode: true } }, defaults)
    expect(merged.theming).toEqual({ theme: 'default', darkMode: true, tocPosition: 'left' })
    expect(merged.pageExtensions).toEqual(['md', 'html', 'txt'])
  })

  it('keeps configured arrays as they are', () => {
    expect(cfgHelper.withDefaults({ pageExtensions: ['md'] }, defaults).pageExtensions).toEqual(['md'])
    expect(cfgHelper.withDefaults({ pageExtensions: [] }, defaults).pageExtensions).toEqual([])
  })

  it('keeps explicit null and false values and does not modify its inputs', () => {
    const config = { theming: { darkMode: false, theme: null } }
    const merged = cfgHelper.withDefaults(config, defaults)
    expect(merged.theming).toMatchObject({ darkMode: false, theme: null })
    expect(config).toEqual({ theming: { darkMode: false, theme: null } })
    expect(defaults.pageExtensions).toEqual(['md', 'html', 'txt'])
  })
})

describe('helpers/config/parseConfigValue', () => {
  it('replaces environment variables, with defaults', () => {
    process.env.WIKI_TEST_DB_HOST = 'db.example.com'
    expect(cfgHelper.parseConfigValue('host: $(WIKI_TEST_DB_HOST)\nport: $(WIKI_TEST_DB_PORT:5432)')).toBe('host: db.example.com\nport: 5432')
    delete process.env.WIKI_TEST_DB_HOST
  })
})

describe('helpers/config/isValidDurationString', () => {
  it('accepts ISO 8601 durations only', () => {
    expect(cfgHelper.isValidDurationString('PT15M')).toBe(true)
    expect(cfgHelper.isValidDurationString('P1D')).toBe(true)
    expect(cfgHelper.isValidDurationString('15 minutes')).toBe(false)
  })
})
