'use strict'

const _ = require('lodash')

const isoDurationReg = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/

module.exports = {
  /**
   * Parse configuration value for environment vars
   *
   * Replaces `$(ENV_VAR_NAME)` with value of `ENV_VAR_NAME` environment variable.
   *
   * Also supports defaults by if provided as `$(ENV_VAR_NAME:default)`
   *
   * @param {any} cfg Configuration value
   * @returns Parse configuration value
   */
  parseConfigValue (cfg) {
    return _.replace(
      cfg,
      /\$\(([A-Z0-9_]+)(?::(.+))?\)/g,
      (fm, m, d) => { return process.env[m] || d }
    )
  },

  isValidDurationString (val) {
    return isoDurationReg.test(val)
  },

  /**
   * Fill the missing settings of a configuration object from defaults.
   * Like _.defaultsDeep, but arrays are values: a configured array (even an
   * empty one) replaces the default instead of being merged index by index.
   *
   * @param {Object} config Configuration
   * @param {Object} defaults Default values
   * @returns {Object} Merged configuration (new object)
   */
  withDefaults (config, defaults) {
    return _.mergeWith({}, defaults, config, (objValue, srcValue) => {
      if (Array.isArray(srcValue)) {
        return srcValue
      }
    })
  }
}
