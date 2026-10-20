const fs = require('fs-extra')
const os = require('os')
const path = require('path')

describe('storage/disk/common processPage', () => {
  let commonDisk
  let dir
  const user = { id: 1, name: 'Administrator', email: 'admin@example.com' }
  const dbPage = {
    id: 7,
    path: 'docs/setup',
    localeCode: 'en',
    title: 'Setup',
    description: '',
    isPublished: 1,
    content: '# Setup\n',
    tags: [{ tag: 'ops' }, { tag: 'docs' }]
  }

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wikijs-disk-common-'))
    global.WIKI = {
      config: { lang: { code: 'en', namespacing: false } },
      logger: { info: () => {}, warn: () => {} },
      models: {
        pages: {
          parseMetadata: jest.requireActual('../../models/pages').parseMetadata,
          getPageFromDb: async () => dbPage,
          updatePage: jest.fn(async () => {})
        }
      }
    }
    commonDisk = require('../../modules/storage/disk/common')
  })

  afterAll(() => {
    fs.removeSync(dir)
    delete global.WIKI
  })

  beforeEach(() => {
    global.WIKI.models.pages.updatePage.mockClear()
  })

  const importFile = async raw => {
    fs.outputFileSync(path.join(dir, 'docs/setup.md'), raw)
    await commonDisk.processPage({ user, fullPath: dir, relPath: 'docs/setup.md', contentType: 'markdown', moduleName: 'GIT' })
  }

  it('skips files identical to the DB (no new version, author untouched)', async () => {
    await importFile('---\ntitle: Setup\ndescription: \npublished: true\ntags: docs, ops\n---\n\n# Setup\n')
    expect(global.WIKI.models.pages.updatePage).not.toHaveBeenCalled()
  })

  it('imports changed content', async () => {
    await importFile('---\ntitle: Setup\ndescription: \npublished: true\ntags: docs, ops\n---\n\n# Setup (edited in git)\n')
    expect(global.WIKI.models.pages.updatePage).toHaveBeenCalledWith(expect.objectContaining({
      id: 7,
      content: '# Setup (edited in git)\n',
      skipStorage: true
    }))
  })
})
