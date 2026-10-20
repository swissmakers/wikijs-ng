const theming = require('../../graph/resolvers/theming')

/* global WIKI */

describe('GraphQL theme settings', () => {
  beforeEach(() => {
    global.WIKI = {
      config: {
        theming: { theme: 'default', iconset: 'mdi', darkMode: true, tocPosition: 'left' }
      },
      configSvc: { saveToDb: jest.fn().mockResolvedValue(true) }
    }
  })

  afterAll(() => {
    delete global.WIKI
  })

  it.each([undefined, null, ''])('loads theme settings when custom CSS is %p', async injectCSS => {
    if (injectCSS !== undefined) {
      WIKI.config.theming.injectCSS = injectCSS
    }
    const config = await theming.ThemingQuery.config()
    expect(config).toMatchObject({ theme: 'default', iconset: 'mdi', darkMode: true, injectCSS: '' })
  })

  it('returns existing CSS in editable form', async () => {
    WIKI.config.theming.injectCSS = '.contents{color:red}'
    const config = await theming.ThemingQuery.config()
    expect(config.injectCSS).toContain('.contents')
    expect(config.injectCSS).toContain('color: red')
    expect(WIKI.config.theming.injectCSS).toBe('.contents{color:red}')
  })

  it('persists cleared injections and reads them back as empty strings', async () => {
    Object.assign(WIKI.config.theming, {
      injectCSS: '.contents{color:red}',
      injectHead: '<meta name="custom" content="1">',
      injectBody: '<!-- custom -->'
    })
    const result = await theming.ThemingMutation.setConfig(null, {
      theme: 'default',
      iconset: 'fa',
      darkMode: true,
      tocPosition: 'right',
      injectCSS: '',
      injectHead: '',
      injectBody: ''
    })
    expect(result.responseResult.succeeded).toBe(true)
    expect(WIKI.configSvc.saveToDb).toHaveBeenCalledWith(['theming'])
    expect(WIKI.config.theming).toMatchObject({ iconset: 'fa', tocPosition: 'right', injectCSS: '', injectHead: '', injectBody: '' })
    expect(await theming.ThemingQuery.config()).toMatchObject({ injectCSS: '', injectHead: '', injectBody: '' })
  })
})
