const _ = require('lodash')
const crypto = require('crypto')
const dotize = require('dotize')
const i18nMW = require('i18next-http-middleware')
const i18next = require('i18next')
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

/* global WIKI */

module.exports = {
  engine: null,
  namespaces: [],
  /**
   * Bundled locales (server/locales), always available offline
   */
  bundled: [],
  /**
   * Locales provided by the admin in <dataPath>/sideload/locales
   */
  sideloaded: [],
  /**
   * Hash of all loaded strings, lets clients invalidate their cache
   */
  version: '',
  async init() {
    this.bundled = await WIKI.models.locales.getBundledLocales()
    this.namespaces = await this.getBundleNamespaces('en')

    this.engine = i18next
    await this.engine.init({
      load: 'languageOnly',
      ns: this.namespaces,
      defaultNS: 'common',
      saveMissing: false,
      lng: WIKI.config.lang.code,
      fallbackLng: 'en'
    })

    // -> Every bundled / sideloaded locale needs a DB row (FK target of pages, users, pageTree)
    await WIKI.models.locales.syncRows(this.bundled, { clearStrings: true })
    await this.loadSideloadManifest()

    await this.refreshNamespaces(true)

    return this
  },
  /**
   * Attach i18n middleware for Express
   *
   * @param {Object} app Express Instance
   */
  attachMiddleware (app) {
    app.use(i18nMW.handle(this.engine))
  },
  /**
   * Path of the sideload folder for custom / overriding locales
   */
  getSideloadPath() {
    return path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'sideload/locales')
  },
  isBundled(code) {
    return _.some(this.bundled, ['code', code])
  },
  /**
   * Read the sideload manifest (optional) and register the sideloaded locales
   */
  async loadSideloadManifest() {
    this.sideloaded = []
    const sideloadPath = this.getSideloadPath()
    if (!await fs.pathExists(sideloadPath)) {
      return
    }
    try {
      const manifest = await WIKI.models.locales.readManifest(sideloadPath)
      const files = (await fs.readdir(sideloadPath)).filter(f => f.endsWith('.yml') && f !== 'locales.yml')
      for (const file of files) {
        const code = path.basename(file, '.yml')
        const meta = _.find(manifest, ['code', code])
        if (meta) {
          this.sideloaded.push(meta)
        } else if (this.isBundled(code)) {
          // -> Override file for a bundled locale, no metadata needed
          this.sideloaded.push(_.find(this.bundled, ['code', code]))
        } else {
          WIKI.logger.warn(`Sideloaded locale ${file} has no entry in ${path.join(sideloadPath, 'locales.yml')}: [ SKIPPED ]`)
        }
      }
      await WIKI.models.locales.syncRows(this.sideloaded.filter(lc => !this.isBundled(lc.code)))
      if (this.sideloaded.length > 0) {
        WIKI.logger.info(`Sideloaded locales: ${_.map(this.sideloaded, 'code').join(', ')}`)
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to read sideloaded locales: ${err.message}`)
    }
  },
  /**
   * Read a locale YAML file (top-level keys are namespaces)
   *
   * @param {String} filePath Path to the YAML file
   * @returns {Promise<Object|null>} Namespaces or null if the file doesn't exist
   */
  async readLocaleFile(filePath) {
    if (!await fs.pathExists(filePath)) {
      return null
    }
    const entries = yaml.load(await fs.readFile(filePath, 'utf8'))
    return _.isPlainObject(entries) ? entries : null
  },
  /**
   * Get the namespaces defined in a bundled locale file
   *
   * @param {String} code Locale code
   */
  async getBundleNamespaces(code) {
    const entries = await this.readLocaleFile(path.join(WIKI.SERVERPATH, `locales/${code}.yml`))
    return entries ? _.keys(entries) : ['common']
  },
  /**
   * Get all entries for a specific locale and namespace
   *
   * @param {String} locale Locale code
   * @param {String} namespace Namespace
   */
  async getByNamespace(locale, namespace) {
    if (!this.engine.hasResourceBundle(locale, namespace)) {
      return []
    }
    const data = this.engine.getResourceBundle(locale, namespace)
    return _.map(dotize.convert(data), (value, key) => {
      return {
        key,
        value
      }
    })
  },
  /**
   * Load all strings of a single locale.
   * Order: bundled file -> DB strings (only for non-bundled, legacy packs) -> sideload overlay
   *
   * @param {String} locale Locale code
   * @param {*} opts Additional options
   */
  async loadLocale(locale, opts = { silent: false }) {
    const layers = []

    // -> Bundled locale file (base strings, always available offline)
    const bundledEntries = await this.readLocaleFile(path.join(WIKI.SERVERPATH, `locales/${locale}.yml`))
    if (bundledEntries) {
      layers.push(bundledEntries)
    } else {
      // -> Locale packs downloaded by older versions live in the DB
      const res = await WIKI.models.locales.query().findOne('code', locale)
      if (res && _.isPlainObject(res.strings) && !_.isEmpty(res.strings)) {
        layers.push(res.strings)
      }
    }

    // -> Sideloaded overrides / custom locales
    try {
      const sideloadEntries = await this.readLocaleFile(path.join(this.getSideloadPath(), `${locale}.yml`))
      if (sideloadEntries) {
        layers.push(sideloadEntries)
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to load sideloaded locale ${locale}: ${err.message}`)
    }

    if (layers.length < 1) {
      if (!opts.silent) {
        throw new Error('No such locale in local store.')
      }
      return
    }

    for (const layer of layers) {
      _.forOwn(layer, (data, ns) => {
        this.namespaces = _.union(this.namespaces, [ns])
        this.engine.addResourceBundle(locale, ns, data, true, true)
      })
    }
  },
  /**
   * Reload the strings of all bundled, sideloaded and active locales
   *
   * @param {Boolean} silent No error on fail
   */
  async refreshNamespaces (silent = false) {
    const codes = _.uniq([
      ..._.map(this.bundled, 'code'),
      ..._.map(this.sideloaded, 'code'),
      WIKI.config.lang.code,
      ...(WIKI.config.lang.namespacing ? WIKI.config.lang.namespaces : [])
    ])
    for (const code of codes) {
      await this.loadLocale(code, { silent })
    }
    this.version = crypto.createHash('sha1').update(JSON.stringify(this.engine.store.data)).digest('hex').substring(0, 12)
  },
  /**
   * Set the active locale
   *
   * @param {String} locale Locale code
   */
  async setCurrentLocale(locale) {
    await this.engine.changeLanguage(locale)
  }
}
