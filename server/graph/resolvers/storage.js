const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

/* global WIKI */

module.exports = {
  Query: {
    async storage () { return {} }
  },
  Mutation: {
    async storage () { return {} }
  },
  StorageQuery: {
    async targets (obj, args, context, info) {
      let targets = await WIKI.models.storage.getTargets()
      targets = _.sortBy(targets.map(tgt => {
        const targetInfo = _.find(WIKI.data.storage, ['key', tgt.key]) || {}
        return {
          ...targetInfo,
          ...tgt,
          hasSchedule: (targetInfo.schedule !== false),
          syncInterval: tgt.syncInterval || targetInfo.schedule || 'P0D',
          syncIntervalDefault: targetInfo.schedule,
          config: graphHelper.moduleConfigToKV(tgt.config, targetInfo.props, {
            transformValue: (configData, value) => (configData.sensitive && value.length > 0) ? '********' : value
          })
        }
      }), ['title', 'key'])
      return targets
    },
    async status (obj, args, context, info) {
      const activeTargets = await WIKI.models.storage.query().where('isEnabled', true)
      return activeTargets.map(tgt => {
        const targetInfo = _.find(WIKI.data.storage, ['key', tgt.key]) || {}
        return {
          key: tgt.key,
          title: targetInfo.title,
          status: _.get(tgt, 'state.status', 'pending'),
          message: _.get(tgt, 'state.message', 'Initializing...'),
          lastAttempt: _.get(tgt, 'state.lastAttempt', null)
        }
      })
    }
  },
  StorageMutation: {
    async updateTargets (obj, args, context) {
      try {
        const dbTargets = await WIKI.models.storage.getTargets()
        for (const tgt of args.targets) {
          const currentDbTarget = _.find(dbTargets, ['key', tgt.key])
          if (!currentDbTarget) {
            continue
          }
          await WIKI.models.storage.query().patch({
            isEnabled: tgt.isEnabled,
            mode: tgt.mode,
            syncInterval: tgt.syncInterval,
            config: graphHelper.kvToModuleConfig(tgt.config, (key, value) => {
              // -> Masked secrets are sent back unchanged: keep the stored value
              return value === '********' ? _.get(currentDbTarget.config, key, '') : value
            }),
            state: {
              status: 'pending',
              message: 'Initializing...',
              lastAttempt: null
            }
          }).where('key', tgt.key)
        }
        await WIKI.models.storage.initTargets()
        return {
          responseResult: graphHelper.generateSuccess('Storage targets updated successfully')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },
    async executeAction (obj, args, context) {
      try {
        await WIKI.models.storage.executeAction(args.targetKey, args.handler)
        return {
          responseResult: graphHelper.generateSuccess('Action completed.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
