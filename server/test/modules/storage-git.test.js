/**
 * Integration test of the git storage sync against real repositories in a
 * temporary folder: a bare "remote", a second clone acting as an external
 * contributor, and the wiki's working copy. Only the DB import is mocked.
 */
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

jest.mock('../../modules/storage/disk/common', () => ({
  processPage: jest.fn(async () => {}),
  processAsset: jest.fn(async () => {})
}))

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'wikijs-git-test-'))
const REMOTE = path.join(ROOT, 'remote.git')
const EXTERNAL = path.join(ROOT, 'external')
const LOCAL = path.join(ROOT, 'wiki-repo')
const GITCONFIG = path.join(ROOT, 'gitconfig')

// -> Isolated git identity, unaffected by the user's global / system config
fs.outputFileSync(GITCONFIG, '[user]\n  name = External\n  email = external@example.com\n[init]\n  defaultBranch = main\n')
process.env.GIT_CONFIG_GLOBAL = GITCONFIG
process.env.GIT_CONFIG_NOSYSTEM = '1'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const external = (...args) => git(EXTERNAL, ...args)
const externalCommit = (file, content, message) => {
  fs.outputFileSync(path.join(EXTERNAL, file), content)
  external('add', '-A')
  external('commit', '-m', message)
  external('push', 'origin', 'main')
}
const remoteFile = file => {
  external('pull', '--rebase', 'origin', 'main')
  return fs.readFileSync(path.join(EXTERNAL, file), 'utf8')
}

global.WIKI = {
  ROOTPATH: ROOT,
  config: { dataPath: 'data', lang: { code: 'en', namespacing: false } },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  models: {
    users: { getRootUser: async () => ({ name: 'Administrator', email: 'admin@example.com' }) },
    pages: { movePage: jest.fn(async () => {}), deletePage: jest.fn(async () => {}) },
    assets: { query: () => ({ findOne: async ({ hash }) => { assetLookups.push(hash); return null } }) }
  }
}
const assetLookups = []

const commonDisk = require('../../modules/storage/disk/common')
const storage = require('../../modules/storage/git/storage')
const assetHelper = require('../../helpers/asset')

const page = (pagePath, content) => ({
  path: pagePath,
  localeCode: 'en',
  contentType: 'markdown',
  authorName: 'Ann',
  authorEmail: 'ann@example.com',
  injectMetadata: () => content
})

beforeAll(async () => {
  git(ROOT, 'init', '--bare', '-b', 'main', REMOTE)
  git(ROOT, 'clone', REMOTE, EXTERNAL)
  externalCommit('home.md', '# Home\n', 'initial')

  storage.mode = 'sync'
  storage.config = {
    authType: 'ssh',
    repoUrl: REMOTE,
    branch: 'main',
    sshPrivateKeyMode: 'path',
    sshPrivateKeyPath: '/dev/null',
    verifySSL: true,
    defaultEmail: 'wiki@example.com',
    defaultName: 'Wiki',
    localRepoPath: LOCAL,
    alwaysNamespace: false,
    gitBinaryPath: '',
    operationTimeout: 60
  }
  await storage.init()
}, 60000)

afterAll(async () => {
  await fs.remove(ROOT)
  delete global.WIKI
})

beforeEach(() => {
  commonDisk.processPage.mockClear()
  commonDisk.processAsset.mockClear()
  global.WIKI.models.pages.deletePage.mockClear()
  assetLookups.length = 0
})

describe('storage/git sync', () => {
  it('checks out the remote branch on init', () => {
    expect(fs.readFileSync(path.join(LOCAL, 'home.md'), 'utf8')).toBe('# Home\n')
  })

  it('imports changes pushed to the remote', async () => {
    externalCommit('docs/setup.md', '# Setup\n', 'add setup')
    await storage.sync()
    expect(commonDisk.processPage).toHaveBeenCalledWith(expect.objectContaining({ relPath: 'docs/setup.md' }))
  })

  it('pushes page commits made by the wiki', async () => {
    await storage.created(page('docs/new', '# New\n'))
    await storage.sync()
    expect(remoteFile('docs/new.md')).toBe('# New\n')
  })

  it('absorbs leftover worktree changes before pulling', async () => {
    // -> A page file written without a commit (e.g. a crashed commit handler)
    fs.outputFileSync(path.join(LOCAL, 'docs/stranded.md'), '# Stranded\n')
    await storage.sync()
    expect(git(LOCAL, 'status', '--porcelain')).toBe('')
    expect(git(LOCAL, 'log', '-1', '--format=%s', '--', 'docs/stranded.md')).toBe('docs: absorb pending changes')
    expect(remoteFile('docs/stranded.md')).toBe('# Stranded\n')
  })

  it('resolves conflicting edits in favour of the wiki and converges', async () => {
    externalCommit('home.md', '# Home (edited in git)\n', 'external edit')
    await storage.updated(page('home', '# Home (edited in the wiki)\n'))
    await storage.sync()
    expect(remoteFile('home.md')).toBe('# Home (edited in the wiki)\n')
    expect(git(LOCAL, 'rev-parse', 'HEAD')).toBe(git(LOCAL, 'rev-parse', 'origin/main'))
  })

  it('recovers from an interrupted rebase', async () => {
    externalCommit('home.md', '# Home v3 (git)\n', 'external edit 2')
    await storage.updated(page('home', '# Home v3 (wiki)\n'))
    // -> A plain pull --rebase stops on the conflict and leaves the rebase in progress
    expect(() => git(LOCAL, 'pull', '--rebase', 'origin', 'main')).toThrow()
    expect(fs.pathExistsSync(path.join(LOCAL, '.git/rebase-merge')) || fs.pathExistsSync(path.join(LOCAL, '.git/rebase-apply'))).toBe(true)

    await storage.sync()
    expect(fs.pathExistsSync(path.join(LOCAL, '.git/rebase-merge'))).toBe(false)
    expect(fs.pathExistsSync(path.join(LOCAL, '.git/rebase-apply'))).toBe(false)
    expect(remoteFile('home.md')).toBe('# Home v3 (wiki)\n')
  })

  it('retries a push rejected because the remote moved in between', async () => {
    await storage.created(page('docs/race', '# Race\n'))
    const realPush = storage.git.push.bind(storage.git)
    const pushSpy = jest.spyOn(storage.git, 'push').mockImplementationOnce(async (...args) => {
      // -> Someone pushes after our pull, before our push
      externalCommit('docs/other.md', '# Other\n', 'racing push')
      return realPush(...args)
    })
    await storage.sync()
    pushSpy.mockRestore()
    expect(remoteFile('docs/race.md')).toBe('# Race\n')
    expect(remoteFile('docs/other.md')).toBe('# Other\n')

    // -> The change fetched by the retry is imported on the next run
    await storage.sync()
    expect(commonDisk.processPage).toHaveBeenCalledWith(expect.objectContaining({ relPath: 'docs/other.md' }))
  })

  it('imports added, renamed and deleted text assets', async () => {
    externalCommit('files/notes.txt', 'one\ntwo\n', 'add text asset')
    await storage.sync()
    expect(commonDisk.processAsset).toHaveBeenCalledWith(expect.objectContaining({ relPath: 'files/notes.txt' }))

    commonDisk.processAsset.mockClear()
    fs.ensureDirSync(path.join(EXTERNAL, 'archive'))
    external('mv', 'files/notes.txt', 'archive/notes.txt')
    external('commit', '-m', 'move asset')
    external('push', 'origin', 'main')
    await storage.sync()
    expect(assetLookups).toContain(assetHelper.generateHash('files/notes.txt'))
    expect(commonDisk.processAsset).toHaveBeenCalledWith(expect.objectContaining({ relPath: 'archive/notes.txt' }))

    commonDisk.processAsset.mockClear()
    assetLookups.length = 0
    external('rm', 'archive/notes.txt')
    external('commit', '-m', 'delete asset')
    external('push', 'origin', 'main')
    await storage.sync()
    expect(assetLookups).toEqual([assetHelper.generateHash('archive/notes.txt')])
    expect(commonDisk.processAsset).not.toHaveBeenCalled()
  })

  it('deletes pages removed in git', async () => {
    externalCommit('docs/empty.md', '', 'add empty page')
    await storage.sync()
    external('rm', 'docs/empty.md')
    external('commit', '-m', 'delete empty page')
    external('push', 'origin', 'main')
    await storage.sync()
    expect(global.WIKI.models.pages.deletePage).toHaveBeenCalledWith(expect.objectContaining({ path: 'docs/empty' }))
  })

  it('does not commit files excluded by .gitignore', async () => {
    externalCommit('.gitignore', 'private/\n', 'ignore private')
    await storage.sync()
    const before = git(LOCAL, 'rev-parse', 'HEAD')
    await storage.created(page('private/secret', '# Secret\n'))
    expect(git(LOCAL, 'rev-parse', 'HEAD')).toBe(before)
    // -> Git metadata files are never imported as assets
    expect(commonDisk.processAsset).not.toHaveBeenCalled()
  })
})
