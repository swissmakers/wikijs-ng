/* global WIKI */

const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')
const { DateTime } = require('luxon')

module.exports = {
  /**
   * Get default value of type
   *
   * @param {any} type primitive type name
   * @returns Default value
   */
  getTypeDefaultValue (type) {
    switch (type.toLowerCase()) {
      case 'string':
        return ''
      case 'number':
        return 0
      case 'boolean':
        return false
    }
  },
  parseModuleProps (props) {
    return _.transform(props, (result, value, key) => {
      let defaultValue = ''
      if (_.isPlainObject(value)) {
        defaultValue = !_.isNil(value.default) ? value.default : this.getTypeDefaultValue(value.type)
      } else {
        defaultValue = this.getTypeDefaultValue(value)
      }
      _.set(result, key, {
        default: defaultValue,
        type: (value.type || value).toLowerCase(),
        title: value.title || _.startCase(key),
        hint: value.hint || false,
        enum: value.enum || false,
        multiline: value.multiline || false,
        sensitive: value.sensitive || false,
        maxWidth: value.maxWidth || 0,
        order: value.order || 100
      })
      return result
    }, {})
  },
  getCookieOpts () {
    return {
      expires: DateTime.utc().plus({ days: 365 }).toJSDate(),
      ...(WIKI.config.host.startsWith('https://') ? { secure: true } : {})
    }
  },
  /**
   * Load module definitions from disk into WIKI.data[dataKey]
   *
   * @param {Object} opts Options
   * @param {string} opts.dirName Directory under server/modules to scan
   * @param {string} opts.dataKey Key under WIKI.data to populate
   * @param {Function} [opts.mapDefinition] Extra fields to merge into each definition
   * @returns {Promise<Array>} The loaded definitions
   */
  async loadModuleDefinitions ({ dirName, dataKey, mapDefinition = null }) {
    const moduleDirs = await fs.readdir(path.join(WIKI.SERVERPATH, `modules/${dirName}`))
    const definitions = []
    for (const dir of moduleDirs) {
      const def = await fs.readFile(path.join(WIKI.SERVERPATH, `modules/${dirName}`, dir, 'definition.yml'), 'utf8')
      definitions.push(yaml.load(def))
    }
    WIKI.data[dataKey] = definitions.map(def => ({
      ...def,
      ...(mapDefinition ? mapDefinition(def) : {}),
      props: this.parseModuleProps(def.props)
    }))
    return WIKI.data[dataKey]
  },
  /**
   * Sync the module definitions on disk with their database records:
   * insert new modules, backfill newly added config props on existing ones
   * and delete records whose module is no longer present on disk.
   *
   * @param {Object} opts Options
   * @param {string} opts.dirName Directory under server/modules to scan
   * @param {string} opts.dataKey Key under WIKI.data to populate
   * @param {string} opts.model Key under WIKI.models holding the records
   * @param {string} opts.label Human-readable plural name, used in log output
   * @param {Function} [opts.mapDefinition] Extra fields to merge into each definition
   * @param {Function} [opts.isEnabledDefault] Whether a newly inserted module starts enabled
   * @param {Function} [opts.buildInsert] Extra columns to set on newly inserted records
   * @param {Array<Object>} [opts.references] Columns referencing the module key ({ table, column }), see removeMissingModules
   */
  async refreshModulesFromDisk ({ dirName, dataKey, model, label, mapDefinition = null, isEnabledDefault = () => false, buildInsert = null, references = [] }) {
    let trx
    try {
      const dbRecords = await WIKI.models[model].query()

      // -> Fetch definitions from disk
      await this.loadModuleDefinitions({ dirName, dataKey, mapDefinition })

      // -> Insert new modules / backfill config of existing ones
      const newRecords = []
      for (const def of WIKI.data[dataKey]) {
        if (!_.some(dbRecords, ['key', def.key])) {
          newRecords.push({
            key: def.key,
            isEnabled: isEnabledDefault(def),
            ...(buildInsert ? buildInsert(def) : {}),
            config: _.transform(def.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const currentConfig = _.get(_.find(dbRecords, ['key', def.key]), 'config', {})
          await WIKI.models[model].query().patch({
            config: _.transform(def.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, currentConfig)
          }).where('key', def.key)
        }
      }
      if (newRecords.length > 0) {
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (const record of newRecords) {
          await WIKI.models[model].query(trx).insert(record)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newRecords.length} new ${label}: [ OK ]`)
      } else {
        WIKI.logger.info(`No new ${label} found: [ SKIPPED ]`)
      }

      // -> Delete modules that are no longer present on disk
      await this.removeMissingModules({
        model,
        records: dbRecords,
        isPresent: record => _.some(WIKI.data[dataKey], ['key', record.key]),
        references
      })
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new ${label}: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  },
  /**
   * Remove DB records of modules that are no longer present on disk.
   * Records still referenced by other tables (e.g. pages.editorKey) are only
   * disabled, so removing a module never breaks existing content. SQLite does
   * not enforce foreign keys, hence references are checked explicitly.
   *
   * @param {Object} opts Options
   * @param {string} opts.model Key under WIKI.models holding the records
   * @param {Array} opts.records Current DB records
   * @param {Function} opts.isPresent Returns true if the record's module still exists
   * @param {string} [opts.keyField] Record field holding the module key
   * @param {Array<Object>} [opts.references] Referencing columns: { table, column }
   */
  async removeMissingModules ({ model, records, isPresent, keyField = 'key', references = [] }) {
    for (const record of records) {
      if (isPresent(record)) {
        continue
      }
      const key = record[keyField]
      try {
        let refCount = 0
        for (const ref of references) {
          const res = await WIKI.models.knex(ref.table).where(ref.column, record.key).count('* as total').first()
          refCount += _.toSafeInteger(_.get(res, 'total', 0))
        }
        if (refCount < 1) {
          try {
            await WIKI.models[model].query().where('key', record.key).del()
            WIKI.logger.info(`Removed ${key} because it is no longer present in the modules folder: [ OK ]`)
            continue
          } catch (err) {
            WIKI.logger.warn(`Could not delete ${key} (${err.message}), disabling it instead.`)
          }
        }
        if (record.isEnabled !== false) {
          await WIKI.models[model].query().patch({ isEnabled: false }).where('key', record.key)
        }
        WIKI.logger.warn(`Module ${key} is no longer present in the modules folder but is still referenced by ${refCount} record(s): [ DISABLED ]`)
      } catch (err) {
        WIKI.logger.warn(`Failed to remove missing module ${key}: ${err.message}`)
      }
    }
  }
}
