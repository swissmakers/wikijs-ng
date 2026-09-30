const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')
const _ = require('lodash')

/* global WIKI */

/**
 * Locales model
 */
module.exports = class Locale extends Model {
  static get tableName() { return 'locales' }
  static get idColumn() { return 'code' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['code', 'name'],

      properties: {
        code: {type: 'string'},
        isRTL: {type: 'boolean', default: false},
        name: {type: 'string'},
        nativeName: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'},
        availability: {type: 'integer'}
      }
    }
  }

  static get jsonAttributes() {
    return ['strings']
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }

  /**
   * Read a locales manifest (list of { code, name, nativeName, isRTL })
   * and keep only entries that have a matching <code>.yml file.
   *
   * @param {String} dir Folder containing locales.yml and the locale files
   * @returns {Promise<Array>} Manifest entries
   */
  static async readManifest(dir) {
    const manifestPath = path.join(dir, 'locales.yml')
    if (!await fs.pathExists(manifestPath)) {
      return []
    }
    const entries = yaml.load(await fs.readFile(manifestPath, 'utf8')) || []
    const result = []
    for (const entry of entries) {
      if (!entry || !_.isString(entry.code) || !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,4})?$/.test(entry.code) || entry.code.length > 5) {
        WIKI.logger.warn(`Ignoring invalid locale entry in ${manifestPath}`)
        continue
      }
      if (!await fs.pathExists(path.join(dir, `${entry.code}.yml`))) {
        WIKI.logger.warn(`Locale ${entry.code} is listed in ${manifestPath} but ${entry.code}.yml is missing.`)
        continue
      }
      result.push({
        code: entry.code,
        name: entry.name || entry.code,
        nativeName: entry.nativeName || entry.name || entry.code,
        isRTL: entry.isRTL === true
      })
    }
    return result
  }

  /**
   * Bundled locales shipped in server/locales
   */
  static async getBundledLocales() {
    return WIKI.models.locales.readManifest(path.join(WIKI.SERVERPATH, 'locales'))
  }

  /**
   * Make sure every given locale has a DB row (pages, users and the page tree
   * reference locales.code), keeping name / nativeName / isRTL in sync.
   *
   * @param {Array} entries Manifest entries
   * @param {Object} opts Options
   * @param {Boolean} opts.clearStrings Remove DB strings (bundled locales never read them)
   */
  static async syncRows(entries, { clearStrings = false } = {}) {
    if (entries.length < 1) {
      return
    }
    const existing = await WIKI.models.locales.query().whereIn('code', _.map(entries, 'code'))
    for (const entry of entries) {
      const meta = _.pick(entry, ['name', 'nativeName', 'isRTL'])
      const row = _.find(existing, ['code', entry.code])
      if (!row) {
        await WIKI.models.locales.query().insert({
          code: entry.code,
          strings: {},
          ...meta
        })
      } else {
        const hasStrings = _.isPlainObject(row.strings) && !_.isEmpty(row.strings)
        const rowMeta = { name: row.name, nativeName: row.nativeName, isRTL: Boolean(row.isRTL) }
        if (!_.isEqual(rowMeta, meta) || (clearStrings && hasStrings)) {
          await WIKI.models.locales.query().patch({
            ...meta,
            ...(clearStrings ? { strings: {} } : {})
          }).where('code', entry.code)
        }
      }
    }
  }

  static async getNavLocales({ cache = false } = {}) {
    if (!WIKI.config.lang.namespacing) {
      return []
    }

    if (cache) {
      const navLocalesCached = await WIKI.cache.get('nav:locales')
      if (navLocalesCached) {
        return navLocalesCached
      }
    }
    const navLocales = await WIKI.models.locales.query().select('code', 'nativeName AS name').whereIn('code', WIKI.config.lang.namespaces).orderBy('code')
    if (navLocales) {
      if (cache) {
        await WIKI.cache.set('nav:locales', navLocales, 300)
      }
      return navLocales
    } else {
      WIKI.logger.warn('Site Locales for navigation are missing or corrupted.')
      return []
    }
  }
}
