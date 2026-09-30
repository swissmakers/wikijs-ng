const Model = require('objection').Model
const _ = require('lodash')
const commonHelper = require('../helpers/common')
const configHelper = require('../helpers/config')

/* global WIKI */

/**
 * Storage model
 */
module.exports = class Storage extends Model {
  static get tableName() { return 'storage' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        mode: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config', 'state']
  }

  static async getTargets() {
    return WIKI.models.storage.query()
  }

  static async refreshTargetsFromDisk() {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'storage',
      dataKey: 'storage',
      model: 'storage',
      label: 'storage targets',
      mapDefinition: def => ({ isAvailable: _.get(def, 'isAvailable', false) }),
      buildInsert: def => ({
        mode: def.defaultMode || 'push',
        syncInterval: def.schedule || 'P0D',
        state: {
          status: 'pending',
          message: '',
          lastAttempt: null
        }
      })
    })
  }

  /**
   * Initialize active storage targets
   */
  static async initTargets() {
    this.targets = await WIKI.models.storage.query().where('isEnabled', true).orderBy('key')
    try {
      // -> Stop and delete existing jobs
      const prevjobs = _.remove(WIKI.scheduler.jobs, job => job.name === `sync-storage`)
      if (prevjobs.length > 0) {
        prevjobs.forEach(job => { job.stop().catch(() => {}) })
      }

      // -> Initialize targets
      const failedTargets = []
      for (let target of this.targets) {
        const targetDef = _.find(WIKI.data.storage, ['key', target.key])
        target.fn = require(`../modules/storage/${target.key}/storage`)
        target.fn.config = target.config
        target.fn.mode = target.mode
        try {
          await target.fn.init()

          // -> Save succeeded init state
          await WIKI.models.storage.query().patch({
            state: {
              status: 'operational',
              message: '',
              lastAttempt: new Date().toISOString()
            }
          }).where('key', target.key)

          // -> Set recurring sync job
          if (targetDef.schedule && target.syncInterval !== `P0D`) {
            let syncInterval = target.syncInterval
            if (!configHelper.isValidDurationString(syncInterval)) {
              WIKI.logger.warn(`Invalid sync interval '${syncInterval}' for storage target ${target.key}. Falling back to default (${targetDef.schedule}).`)
              syncInterval = targetDef.schedule
            }
            WIKI.scheduler.registerJob({
              name: `sync-storage`,
              immediate: false,
              schedule: syncInterval,
              repeat: true
            }, target.key)
          }

          // -> Set internal recurring sync job
          if (targetDef.internalSchedule && targetDef.internalSchedule !== `P0D` && configHelper.isValidDurationString(targetDef.internalSchedule)) {
            WIKI.scheduler.registerJob({
              name: `sync-storage`,
              immediate: false,
              schedule: targetDef.internalSchedule,
              repeat: true
            }, target.key)
          }
        } catch (err) {
          WIKI.logger.warn(`Failed to initialize storage target ${target.key}: ${err.message}`)
          failedTargets.push(target.key)

          // -> Save initialization error
          await WIKI.models.storage.query().patch({
            state: {
              status: 'error',
              message: err.message,
              lastAttempt: new Date().toISOString()
            }
          }).where('key', target.key)
        }
      }

      // -> Remove failed targets so page/asset events are not dispatched to half-initialized modules
      if (failedTargets.length > 0) {
        _.remove(this.targets, t => _.includes(failedTargets, t.key))
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  static async pageEvent({ event, page }) {
    try {
      for (let target of this.targets) {
        await target.fn[event](page)
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  static async assetEvent({ event, asset }) {
    try {
      for (let target of this.targets) {
        await target.fn[`asset${_.capitalize(event)}`](asset)
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  static async getLocalLocations({ asset }) {
    const locations = []
    const promises = this.targets.map(async (target) => {
      try {
        const path = await target.fn.getLocalLocation(asset)
        locations.push({
          path,
          key: target.key
        })
      } catch (err) {
        WIKI.logger.warn(err)
      }
    })
    await Promise.all(promises)
    return locations
  }

  static async executeAction(targetKey, handler) {
    try {
      const target = _.find(this.targets, ['key', targetKey])
      if (target) {
        if (_.hasIn(target.fn, handler)) {
          await target.fn[handler]()
        } else {
          throw new Error('Invalid Handler for Storage Target')
        }
      } else {
        throw new Error('Invalid or Inactive Storage Target')
      }
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }
}
