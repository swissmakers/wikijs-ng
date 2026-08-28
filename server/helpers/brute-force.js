const { RateLimiterMemory, RateLimiterMySQL, RateLimiterPostgres } = require('rate-limiter-flexible')

/* global WIKI */

const TABLE_NAME = 'brute'
const FREE_RETRIES = 5
const WINDOW_SECONDS = 15 * 60
const BLOCK_SECONDS = 5 * 60

let limiter = null

/**
 * Build a brute-force limiter backed by the wiki database where the driver
 * supports it, falling back to an in-process limiter otherwise.
 */
function createLimiter () {
  const opts = {
    keyPrefix: 'login',
    points: FREE_RETRIES,
    duration: WINDOW_SECONDS,
    blockDuration: BLOCK_SECONDS
  }

  switch (WIKI.config.db.type) {
    case 'postgres':
      return new RateLimiterPostgres({
        ...opts,
        storeClient: WIKI.models.knex,
        storeType: 'knex',
        tableName: TABLE_NAME,
        tableCreated: false
      })
    case 'mysql':
    case 'mariadb':
      return new RateLimiterMySQL({
        ...opts,
        storeClient: WIKI.models.knex,
        storeType: 'knex',
        tableName: TABLE_NAME,
        tableCreated: false
      })
    default:
      WIKI.logger.info(`Brute-force protection uses in-process counters on ${WIKI.config.db.type}: [ OK ]`)
      return new RateLimiterMemory(opts)
  }
}

function getLimiter () {
  if (!limiter) {
    limiter = createLimiter()
  }
  return limiter
}

module.exports = {
  /**
   * Express middleware rejecting requests once too many attempts were made
   * from the same address. Exposes `req.brute.reset()` so a successful
   * authentication can clear the counter.
   */
  async prevent (req, res, next) {
    const key = req.ip
    req.brute = {
      reset: async () => {
        try {
          await getLimiter().delete(key)
        } catch (err) {
          WIKI.logger.warn(err)
        }
      }
    }

    try {
      await getLimiter().consume(key)
      next()
    } catch (err) {
      if (err instanceof Error) {
        // Storage failure must not lock everyone out of the wiki
        WIKI.logger.warn(err)
        return next()
      }
      const retryAfter = Math.ceil((err.msBeforeNext || BLOCK_SECONDS * 1000) / 1000)
      res.set('Retry-After', String(retryAfter))
      res.status(401).send('Too many failed attempts. Try again later.')
    }
  }
}
