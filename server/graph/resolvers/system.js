const _ = require('lodash')
const getos = require('getos')
const os = require('os')
const path = require('path')
const fs = require('fs-extra')
const graphHelper = require('../../helpers/graph')

const getosAsync = require('util').promisify(getos)

/* global WIKI */

const dbTypes = {
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  postgres: 'PostgreSQL',
  sqlite: 'SQLite',
  mssql: 'MS SQL Server'
}

module.exports = {
  Query: {
    async system () { return {} }
  },
  Mutation: {
    async system () { return {} }
  },
  SystemQuery: {
    flags () {
      return _.transform(WIKI.config.flags, (result, value, key) => {
        result.push({ key, value })
      }, [])
    },
    async info () { return {} },
    async exportStatus () {
      return {
        status: WIKI.system.exportStatus.status,
        progress: Math.ceil(WIKI.system.exportStatus.progress),
        message: WIKI.system.exportStatus.message,
        startedAt: WIKI.system.exportStatus.startedAt
      }
    }
  },
  SystemMutation: {
    async updateFlags (obj, args, context) {
      WIKI.config.flags = _.transform(args.flags, (result, row) => {
        _.set(result, row.key, row.value)
      }, {})
      await WIKI.configSvc.applyFlags()
      await WIKI.configSvc.saveToDb(['flags'])
      return {
        responseResult: graphHelper.generateSuccess('System Flags applied successfully')
      }
    },
    /**
     * Set HTTPS Redirection State
     */
    async setHTTPSRedirection (obj, args, context) {
      _.set(WIKI.config, 'server.sslRedir', args.enabled)
      await WIKI.configSvc.saveToDb(['server'])
      return {
        responseResult: graphHelper.generateSuccess('HTTP Redirection state set successfully.')
      }
    },
    /**
     * Renew SSL Certificate
     */
    async renewHTTPSCertificate (obj, args, context) {
      try {
        if (!WIKI.config.ssl.enabled) {
          throw new WIKI.Error.SystemSSLDisabled()
        } else if (WIKI.config.ssl.provider !== 'letsencrypt') {
          throw new WIKI.Error.SystemSSLRenewInvalidProvider()
        } else if (!WIKI.servers.le) {
          throw new WIKI.Error.SystemSSLLEUnavailable()
        } else {
          await WIKI.servers.le.requestCertificate()
          await WIKI.servers.restartServer('https')
          return {
            responseResult: graphHelper.generateSuccess('SSL Certificate renewed successfully.')
          }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Export Wiki to Disk
     */
    async export (obj, args, context) {
      try {
        const desiredPath = path.resolve(WIKI.ROOTPATH, args.path)
        // -> Check if export process is already running
        if (WIKI.system.exportStatus.status === 'running') {
          throw new Error('Another export is already running.')
        }
        // -> Validate entities
        if (args.entities.length < 1) {
          throw new Error('Must specify at least 1 entity to export.')
        }
        // -> Check target path
        await fs.ensureDir(desiredPath)
        const existingFiles = await fs.readdir(desiredPath)
        if (existingFiles.length) {
          throw new Error('Target directory must be empty!')
        }
        // -> Start export
        WIKI.system.export({
          entities: args.entities,
          path: desiredPath
        })
        return {
          responseResult: graphHelper.generateSuccess('Export started successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },
  SystemInfo: {
    configFile () {
      return WIKI.CONFIGPATH || path.join(WIKI.ROOTPATH, 'config.yml')
    },
    cpuCores () {
      return os.cpus().length
    },
    currentVersion () {
      return WIKI.version
    },
    dbType () {
      return _.get(dbTypes, WIKI.config.db.type, 'Unknown DB')
    },
    async dbVersion () {
      let version = 'Unknown Version'
      switch (WIKI.config.db.type) {
        case 'mariadb':
        case 'mysql': {
          const resultMYSQL = await WIKI.models.knex.raw('SELECT VERSION() as version;')
          version = _.get(resultMYSQL, '[0][0].version', 'Unknown Version')
          break
        }
        case 'mssql': {
          const resultMSSQL = await WIKI.models.knex.raw('SELECT @@VERSION as version;')
          version = _.get(resultMSSQL, '[0].version', 'Unknown Version')
          break
        }
        case 'postgres':
          version = _.get(WIKI.models, 'knex.client.version', 'Unknown Version')
          break
        case 'sqlite':
          version = _.get(WIKI.models, 'knex.client.driver.VERSION', 'Unknown Version')
          break
      }
      return version
    },
    dbHost () {
      if (WIKI.config.db.type === 'sqlite') {
        return WIKI.config.db.storage
      } else {
        return WIKI.config.db.host
      }
    },
    hostname () {
      return os.hostname()
    },
    httpPort () {
      return WIKI.servers.servers.http ? _.get(WIKI.servers.servers.http.address(), 'port', 0) : 0
    },
    httpRedirection () {
      return _.get(WIKI.config, 'server.sslRedir', false)
    },
    httpsPort () {
      return WIKI.servers.servers.https ? _.get(WIKI.servers.servers.https.address(), 'port', 0) : 0
    },
    nodeVersion () {
      return process.version.substr(1)
    },
    async operatingSystem () {
      let osLabel = `${os.type()} (${os.platform()}) ${os.release()} ${os.arch()}`
      if (os.platform() === 'linux') {
        const osInfo = await getosAsync()
        osLabel = `${os.type()} - ${osInfo.dist} (${osInfo.codename || os.platform()}) ${osInfo.release || os.release()} ${os.arch()}`
      }
      return osLabel
    },
    async platform () {
      const isDockerized = await fs.pathExists('/.dockerenv')
      if (isDockerized) {
        return 'docker'
      }
      return os.platform()
    },
    ramTotal () {
      return `${(os.totalmem() / Math.pow(1024, 3)).toFixed(2)} GB`
    },
    sslDomain () {
      return WIKI.config.ssl.enabled && WIKI.config.ssl.provider === 'letsencrypt' ? WIKI.config.ssl.domain : null
    },
    sslExpirationDate () {
      return WIKI.config.ssl.enabled && WIKI.config.ssl.provider === 'letsencrypt' ? _.get(WIKI.config.letsencrypt, 'payload.expires', null) : null
    },
    sslProvider () {
      return WIKI.config.ssl.enabled ? WIKI.config.ssl.provider : null
    },
    sslStatus () {
      return 'OK'
    },
    sslSubscriberEmail () {
      return WIKI.config.ssl.enabled && WIKI.config.ssl.provider === 'letsencrypt' ? WIKI.config.ssl.subscriberEmail : null
    },
    workingDirectory () {
      return process.cwd()
    },
    async groupsTotal () {
      const total = await WIKI.models.groups.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    },
    async pagesTotal () {
      const total = await WIKI.models.pages.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    },
    async usersTotal () {
      const total = await WIKI.models.users.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    },
    async tagsTotal () {
      const total = await WIKI.models.tags.query().count('* as total').first()
      return _.toSafeInteger(total.total)
    }
  }
}
