const _ = require('lodash')
const dotize = require('dotize')
const i18nMW = require('i18next-http-middleware')
const i18next = require('i18next')
const Promise = require('bluebird')
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

/* global WIKI */

module.exports = {
  engine: null,
  namespaces: [],
  init() {
    this.namespaces = WIKI.data.localeNamespaces
    this.engine = i18next
    this.engine.init({
      load: 'languageOnly',
      ns: this.namespaces,
      defaultNS: 'common',
      saveMissing: false,
      lng: WIKI.config.lang.code,
      fallbackLng: 'en'
    })

    // Load current language + namespaces
    this.refreshNamespaces(true)

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
   * Get all entries for a specific locale and namespace
   *
   * @param {String} locale Locale code
   * @param {String} namespace Namespace
   */
  async getByNamespace(locale, namespace) {
    if (this.engine.hasResourceBundle(locale, namespace)) {
      let data = this.engine.getResourceBundle(locale, namespace)
      return _.map(dotize.convert(data), (value, key) => {
        return {
          key,
          value
        }
      })
    } else {
      throw new Error('Invalid locale or namespace')
    }
  },
  /**
   * Load entries from the DB for a single locale
   *
   * @param {String} locale Locale code
   * @param {*} opts Additional options
   */
  async loadLocale(locale, opts = { silent: false }) {
    // -> Load bundled locale file first (base strings, always available offline)
    try {
      const fileEntriesRaw = await fs.readFile(path.join(WIKI.SERVERPATH, `locales/${locale}.yml`), 'utf8')
      if (fileEntriesRaw) {
        const fileEntries = yaml.load(fileEntriesRaw)
        _.forOwn(fileEntries, (data, ns) => {
          this.namespaces.push(ns)
          this.engine.addResourceBundle(locale, ns, data, true, true)
        })
        WIKI.logger.info(`Loaded bundled locale strings from ${locale}.yml`)
      }
    } catch (err) {
      // no bundled file for this locale
    }

    // -> DB strings (downloaded packs + admin overrides) take precedence over the bundled base
    const res = await WIKI.models.locales.query().findOne('code', locale)
    if (res) {
      if (_.isPlainObject(res.strings)) {
        _.forOwn(res.strings, (data, ns) => {
          this.namespaces.push(ns)
          this.engine.addResourceBundle(locale, ns, data, true, true)
        })
      }
    } else if (!opts.silent) {
      throw new Error('No such locale in local store.')
    }
  },
  /**
   * Reload all namespaces for all active locales from the DB
   *
   * @param {Boolean} silent No error on fail
   */
  async refreshNamespaces (silent = false) {
    await this.loadLocale(WIKI.config.lang.code, { silent })
    if (WIKI.config.lang.namespacing) {
      for (let ns of WIKI.config.lang.namespaces) {
        await this.loadLocale(ns, { silent })
      }
    }
  },
  /**
   * Set the active locale
   *
   * @param {String} locale Locale code
   */
  async setCurrentLocale(locale) {
    await Promise.fromCallback(cb => {
      return this.engine.changeLanguage(locale, cb)
    })
  }
}
