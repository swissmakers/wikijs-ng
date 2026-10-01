describe('helpers/brute-force', () => {
  let bruteForce

  beforeEach(() => {
    jest.resetModules()
    global.WIKI = {
      config: { db: { type: 'sqlite' } },
      logger: { info: jest.fn(), warn: jest.fn() }
    }
    bruteForce = require('../../helpers/brute-force')
  })

  afterEach(() => {
    delete global.WIKI
  })

  const attempt = async (ip = '10.0.0.1') => {
    const req = { ip }
    const res = {
      headers: {},
      statusCode: 200,
      set (name, value) { this.headers[name] = value },
      status (code) { this.statusCode = code; return this },
      send: jest.fn()
    }
    const next = jest.fn()
    await bruteForce.prevent(req, res, next)
    return { req, res, passed: next.mock.calls.length === 1 }
  }

  it('blocks an address after 5 attempts', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await attempt()).passed).toBe(true)
    }
    const blocked = await attempt()
    expect(blocked.passed).toBe(false)
    expect(blocked.res.statusCode).toBe(401)
    expect(Number(blocked.res.headers['Retry-After'])).toBeGreaterThan(0)
    // -> Other addresses are not affected
    expect((await attempt('10.0.0.2')).passed).toBe(true)
  })

  it('clears the counter on reset', async () => {
    let last
    for (let i = 0; i < 5; i++) {
      last = await attempt()
    }
    await last.req.brute.reset()
    expect((await attempt()).passed).toBe(true)
  })
})
