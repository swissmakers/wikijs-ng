describe('models/storage event dispatch', () => {
  let Storage
  let patches
  const page = { localeCode: 'en', path: 'docs/setup' }

  beforeAll(() => {
    global.WIKI = {
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      models: {
        storage: {
          query: () => ({ patch: state => ({ where: async (col, key) => { patches.push({ key, ...state }) } }) })
        }
      }
    }
    Storage = require('../../models/storage')
  })

  afterAll(() => {
    delete global.WIKI
  })

  beforeEach(() => {
    patches = []
  })

  const target = (key, fn) => ({ key, fn: { updated: jest.fn(fn), assetDeleted: jest.fn(fn) } })

  it('never fails the page action when a target fails', async () => {
    Storage.targets = [
      target('git', async () => { throw new Error('spawn git EAGAIN') }),
      target('disk', async () => {})
    ]
    await expect(Storage.pageEvent({ event: 'updated', page })).resolves.toBeUndefined()
    // -> The remaining targets still receive the event
    expect(Storage.targets[1].fn.updated).toHaveBeenCalledWith(page)
  })

  it('flags the failing target in its state', async () => {
    Storage.targets = [target('git', async () => { throw new Error('spawn git EAGAIN') })]
    await Storage.pageEvent({ event: 'updated', page })
    expect(patches).toEqual([expect.objectContaining({
      key: 'git',
      state: expect.objectContaining({ status: 'error', message: expect.stringContaining('spawn git EAGAIN') })
    })])
  })

  it('dispatches asset events with the prefixed handler', async () => {
    Storage.targets = [target('git', async () => {})]
    await Storage.assetEvent({ event: 'deleted', asset: { path: 'files/a.png' } })
    expect(Storage.targets[0].fn.assetDeleted).toHaveBeenCalledWith({ path: 'files/a.png' })
    expect(patches).toEqual([])
  })
})
