const _ = require('lodash')

module.exports = {
  generateSuccess (msg) {
    return {
      succeeded: true,
      errorCode: 0,
      slug: 'ok',
      message: _.defaultTo(msg, 'Operation succeeded.')
    }
  },
  generateError (err, complete = true) {
    const error = {
      succeeded: false,
      errorCode: _.isFinite(err.code) ? err.code : 1,
      slug: err.name,
      message: err.message || 'An unexpected error occured.'
    }
    return (complete) ? { responseResult: error } : error
  },
  /**
   * Convert a module config to the KeyValuePair list used by the admin UI.
   * Each value is a JSON string of the prop definition plus the current value.
   *
   * @param {Object} config Module config (key -> value)
   * @param {Object} props Prop definitions of the module
   * @param {Object} [opts] Options
   * @param {Boolean} [opts.includeUnknown] Also include config keys without a prop definition
   * @param {Function} [opts.transformValue] (propDef, value) => value sent to the client
   * @returns {Array<Object>} KeyValuePairs sorted by key
   */
  moduleConfigToKV (config, props, { includeUnknown = false, transformValue = null } = {}) {
    return _.sortBy(_.transform(config, (res, value, key) => {
      const configData = _.get(props, key, includeUnknown ? {} : false)
      if (configData) {
        res.push({
          key,
          value: JSON.stringify({
            ...configData,
            value: transformValue ? transformValue(configData, value) : value
          })
        })
      }
    }, []), 'key')
  },
  /**
   * Convert KeyValuePairs sent by the admin UI back to a module config
   *
   * @param {Array<Object>} kvList KeyValuePairs ({ key, value: JSON string with a 'v' property })
   * @param {Function} [resolveValue] (key, value) => value to store
   * @returns {Object} Module config
   */
  kvToModuleConfig (kvList, resolveValue = null) {
    return _.reduce(kvList, (result, kv) => {
      let configValue = _.get(JSON.parse(kv.value), 'v', null)
      if (resolveValue) {
        configValue = resolveValue(kv.key, configValue)
      }
      _.set(result, kv.key, configValue)
      return result
    }, {})
  }
}
