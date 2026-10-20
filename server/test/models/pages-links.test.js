describe('models/pages/reconnectLinks', () => {
  let Pages
  let replaced
  let linkTargets

  beforeAll(() => {
    global.WIKI = {
      config: { lang: { code: 'en' } },
      events: { outbound: { emit: () => {} } },
      models: {
        knex: { raw: (sql, [col, from, to]) => ({ from, to }) },
        pages: {
          query: () => ({
            patch: ({ render }) => ({ whereIn: async (col, sub) => { replaced.push([render.from, render.to]); collect(sub) } }),
            column: () => ({ whereIn: async (col, sub) => { collect(sub); return [{ hash: 'h1' }] } })
          }),
          deletePageFromCache: async () => {}
        }
      }
    }
    Pages = require('../../models/pages')
  })

  afterAll(() => {
    delete global.WIKI
  })

  beforeEach(() => {
    replaced = []
    linkTargets = []
  })

  // -> Capture the pageLinks lookup of the subquery builder
  const collect = sub => sub.call({ select: () => ({ from: () => ({ where: where => linkTargets.push(where) }) }) })
  const link = (href, state) => `<a href="${href}" class="is-internal-link is-${state}-page">`

  it('marks links as valid when the page is created (with and without locale prefix)', async () => {
    await Pages.reconnectLinks({ locale: 'en', path: 'docs/setup', mode: 'create' })
    expect(replaced).toEqual([
      [link('/en/docs/setup', 'invalid'), link('/en/docs/setup', 'valid')],
      [link('/docs/setup', 'invalid'), link('/docs/setup', 'valid')]
    ])
    expect(linkTargets[0]).toEqual({ 'pageLinks.path': 'docs/setup', 'pageLinks.localeCode': 'en' })
  })

  it('only uses the prefixed form for other locales', async () => {
    await Pages.reconnectLinks({ locale: 'de', path: 'docs/setup', mode: 'delete' })
    expect(replaced).toEqual([[link('/de/docs/setup', 'valid'), link('/de/docs/setup', 'invalid')]])
  })

  it('rewrites links of pages pointing to the previous path when moving', async () => {
    await Pages.reconnectLinks({ sourceLocale: 'en', sourcePath: 'docs/old', locale: 'en', path: 'docs/new', mode: 'move' })
    expect(replaced).toEqual([
      [link('/en/docs/old', 'valid'), link('/en/docs/new', 'valid')],
      [link('/docs/old', 'valid'), link('/docs/new', 'valid')]
    ])
    expect(linkTargets[0]).toEqual({ 'pageLinks.path': 'docs/old', 'pageLinks.localeCode': 'en' })
  })
})
