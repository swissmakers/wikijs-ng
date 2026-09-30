const _ = require('lodash')
const graphHelper = require('../../helpers/graph')

// Reference implementations: the conversion code that was inlined in the module resolvers
const legacyToKV = (config, props, fallback = false) => _.sortBy(_.transform(config, (res, value, key) => {
  const configData = _.get(props, key, fallback)
  if (configData) {
    res.push({ key, value: JSON.stringify({ ...configData, value }) })
  }
}, []), 'key')

const legacyFromKV = kvList => _.reduce(kvList, (result, value, key) => {
  _.set(result, `${value.key}`, _.get(JSON.parse(value.value), 'v', null))
  return result
}, {})

const props = {
  host: { type: 'String', title: 'Host', default: 'localhost', order: 1 },
  port: { type: 'Number', title: 'Port', default: 5432, order: 2 },
  secret: { type: 'String', title: 'Secret', sensitive: true, order: 3 },
  ssl: { type: 'Boolean', title: 'SSL', default: false, order: 4 }
}
const config = { ssl: true, host: 'db.example.com', port: 6543, secret: 'hunter2', unknownKey: 'x' }

describe('helpers/graph/moduleConfigToKV', () => {
  it('matches the former inline conversion (known props only)', () => {
    expect(graphHelper.moduleConfigToKV(config, props)).toEqual(legacyToKV(config, props))
  })

  it('matches the former analytics conversion (unknown keys included)', () => {
    const result = graphHelper.moduleConfigToKV(config, props, { includeUnknown: true })
    expect(result).toEqual(legacyToKV(config, props, {}))
    expect(_.map(result, 'key')).toContain('unknownKey')
  })

  it('sorts by key and serializes the prop definition with the value', () => {
    const result = graphHelper.moduleConfigToKV(config, props)
    expect(_.map(result, 'key')).toEqual(['host', 'port', 'secret', 'ssl'])
    expect(JSON.parse(result[1].value)).toEqual({ ...props.port, value: 6543 })
  })

  it('lets a transform mask values', () => {
    const result = graphHelper.moduleConfigToKV(config, props, {
      transformValue: (def, value) => (def.sensitive && value.length > 0) ? '********' : value
    })
    expect(JSON.parse(_.find(result, ['key', 'secret']).value).value).toBe('********')
    expect(JSON.parse(_.find(result, ['key', 'host']).value).value).toBe('db.example.com')
  })
})

describe('helpers/graph/kvToModuleConfig', () => {
  const kvList = [
    { key: 'host', value: JSON.stringify({ v: 'db.local' }) },
    { key: 'port', value: JSON.stringify({ v: 5433 }) },
    { key: 'nested.flag', value: JSON.stringify({ v: true }) },
    { key: 'empty', value: JSON.stringify({}) }
  ]

  it('matches the former inline conversion', () => {
    expect(graphHelper.kvToModuleConfig(kvList)).toEqual(legacyFromKV(kvList))
    expect(graphHelper.kvToModuleConfig(kvList)).toEqual({ host: 'db.local', port: 5433, nested: { flag: true }, empty: null })
  })

  it('lets a resolver replace values (e.g. keep masked secrets)', () => {
    const current = { secret: 'hunter2' }
    const result = graphHelper.kvToModuleConfig([
      { key: 'secret', value: JSON.stringify({ v: '********' }) },
      { key: 'host', value: JSON.stringify({ v: 'db' }) }
    ], (key, value) => value === '********' ? _.get(current, key, '') : value)
    expect(result).toEqual({ secret: 'hunter2', host: 'db' })
  })
})
