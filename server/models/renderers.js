const Model = require('objection').Model
const _ = require('lodash')
const DepGraph = require('dependency-graph').DepGraph
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Renderer model
 */
module.exports = class Renderer extends Model {
  static get tableName () { return 'renderers' }
  static get idColumn () { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: { type: 'string' },
        isEnabled: { type: 'boolean' }
      }
    }
  }

  static get jsonAttributes () {
    return ['config']
  }

  static async getRenderers () {
    return WIKI.models.renderers.query()
  }

  static async fetchDefinitions () {
    return commonHelper.loadModuleDefinitions({
      dirName: 'rendering',
      dataKey: 'renderers'
    })
  }

  static async refreshRenderersFromDisk () {
    return commonHelper.refreshModulesFromDisk({
      dirName: 'rendering',
      dataKey: 'renderers',
      model: 'renderers',
      label: 'renderers',
      isEnabledDefault: def => _.get(def, 'enabledDefault', true)
    })
  }

  static async getRenderingPipeline (contentType) {
    const renderersDb = await WIKI.models.renderers.query().where('isEnabled', true)
    if (renderersDb && renderersDb.length > 0) {
      const renderers = renderersDb.map(rdr => {
        const renderer = _.find(WIKI.data.renderers, ['key', rdr.key])
        return {
          ...renderer,
          config: rdr.config
        }
      })

      // Build tree
      const rawCores = _.filter(renderers, renderer => !_.has(renderer, 'dependsOn')).map(core => {
        core.children = _.filter(renderers, ['dependsOn', core.key])
        return core
      })

      // Build dependency graph
      const graph = new DepGraph({ circular: true })
      rawCores.forEach(core => { graph.addNode(core.key) })
      rawCores.forEach(core => {
        rawCores.forEach(coreTarget => {
          if (core.key !== coreTarget.key) {
            if (core.output === coreTarget.input) {
              graph.addDependency(core.key, coreTarget.key)
            }
          }
        })
      })

      // Filter unused cores
      let activeCoreKeys = _.filter(rawCores, ['input', contentType]).map(core => core.key)
      _.clone(activeCoreKeys).forEach(coreKey => {
        activeCoreKeys = _.union(activeCoreKeys, graph.dependenciesOf(coreKey))
      })
      const activeCores = _.filter(rawCores, core => _.includes(activeCoreKeys, core.key))

      // Rebuild dependency graph with active cores
      const graphActive = new DepGraph({ circular: true })
      activeCores.forEach(core => { graphActive.addNode(core.key) })
      activeCores.forEach(core => {
        activeCores.forEach(coreTarget => {
          if (core.key !== coreTarget.key) {
            if (core.output === coreTarget.input) {
              graphActive.addDependency(core.key, coreTarget.key)
            }
          }
        })
      })

      // Reorder cores in reverse dependency order
      const orderedCores = []
      _.reverse(graphActive.overallOrder()).forEach(coreKey => {
        orderedCores.push(_.find(rawCores, ['key', coreKey]))
      })

      return orderedCores
    } else {
      WIKI.logger.error('Rendering pipeline is empty!')
      return false
    }
  }
}
