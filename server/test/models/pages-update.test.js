const errors = require('../../helpers/error')

describe('models/pages/updatePage', () => {
  let Pages
  let patched
  const ogPage = {
    id: 3,
    path: 'docs/linux',
    localeCode: 'en',
    title: 'Linux Installation',
    description: 'Install on a Linux server',
    content: '# Linux\n',
    isPublished: 1,
    isTemplate: false,
    publishStartDate: '',
    publishEndDate: '',
    updatedAt: '2026-10-01T00:00:00.000Z',
    extra: {}
  }
  const user = { id: 5, name: 'Ann', email: 'ann@example.com' }

  beforeAll(() => {
    global.WIKI = {
      Error: errors,
      events: { outbound: { emit: () => {} } },
      auth: { checkAccess: (usr, perms) => !perms.includes('write:scripts') && !perms.includes('write:styles') },
      data: { searchEngine: { updated: jest.fn(async () => {}), deleted: jest.fn(async () => {}) } },
      models: {
        pageHistory: { addVersion: jest.fn(async () => {}) },
        tags: { associateTags: jest.fn(async () => {}) },
        storage: { pageEvent: jest.fn(async () => {}) },
        pageActivity: { record: jest.fn(async () => {}) },
        knex: { table: () => ({ where: () => ({ update: async () => {} }) }) }
      }
    }
    Pages = require('../../models/pages')
    global.WIKI.models.pages = {
      query: () => ({
        findById: () => Object.assign(Promise.resolve({ ...ogPage }), { select: async () => ({ updatedAt: ogPage.updatedAt }) }),
        patch: data => ({ where: async () => { patched = data } })
      }),
      getPageFromDb: async () => ({ ...ogPage, ...patched, tags: [] }),
      formatPageScripts: Pages.formatPageScripts,
      renderPage: async () => {},
      getSafeContent: async () => ''
    }
  })

  afterAll(() => {
    delete global.WIKI
  })

  beforeEach(() => {
    patched = null
    global.WIKI.models.tags.associateTags.mockClear()
  })

  it('keeps fields that are left out of a partial update', async () => {
    await Pages.updatePage({ id: 3, description: 'Run it standalone', user })
    expect(patched).toEqual(expect.objectContaining({
      title: 'Linux Installation',
      description: 'Run it standalone',
      content: '# Linux\n',
      isPublished: true
    }))
    expect(global.WIKI.models.tags.associateTags).not.toHaveBeenCalled()
  })

  it('applies the fields that are sent', async () => {
    await Pages.updatePage({ id: 3, title: 'Linux', content: '# New\n', isPublished: false, tags: ['ops'], user })
    expect(patched).toEqual(expect.objectContaining({ title: 'Linux', content: '# New\n', isPublished: false }))
    expect(global.WIKI.models.tags.associateTags).toHaveBeenCalledWith(expect.objectContaining({ tags: ['ops'] }))
  })

  it('still rejects empty content', async () => {
    await expect(Pages.updatePage({ id: 3, content: '   ', user })).rejects.toThrow()
  })
})
