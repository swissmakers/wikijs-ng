const Mutex = require('../../helpers/mutex')

describe('helpers/mutex', () => {
  it('runs holders one at a time, in FIFO order', async () => {
    const mutex = new Mutex()
    const log = []
    const task = (name, ms) => () => new Promise(resolve => {
      log.push(`start ${name}`)
      setTimeout(() => {
        log.push(`end ${name}`)
        resolve(name)
      }, ms)
    })
    const results = await Promise.all([
      mutex.runExclusive(task('a', 20)),
      mutex.runExclusive(task('b', 1)),
      mutex.runExclusive(task('c', 5))
    ])
    expect(results).toEqual(['a', 'b', 'c'])
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c'])
  })

  it('releases the lock when a holder fails', async () => {
    const mutex = new Mutex()
    await expect(mutex.runExclusive(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    await expect(mutex.runExclusive(async () => 'next')).resolves.toBe('next')
  })
})
