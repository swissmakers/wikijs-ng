const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const _ = require('lodash')

const ROOT = path.join(__dirname, '../..')
const LOCALES_DIR = path.join(ROOT, 'server/locales')

const load = file => yaml.load(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'))
const flatten = (obj, prefix = '') => _.flatMap(obj, (v, k) => _.isPlainObject(v) ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]])
const placeholders = str => _.uniq((_.toString(str).match(/\{\{\s*[\w.]+\s*\}\}/g) || []).map(p => p.replace(/\s/g, ''))).sort()

const manifest = load('locales.yml')
const codes = _.map(manifest, 'code')
const strings = _.fromPairs(codes.map(code => [code, _.fromPairs(flatten(load(`${code}.yml`)))]))
const enKeys = Object.keys(strings.en)

describe('bundled locales', () => {
  it('lists every bundled locale file in the manifest', () => {
    const files = fs.readdirSync(LOCALES_DIR).filter(f => /^[a-z]{2}(-[a-z]{2})?\.yml$/i.test(f)).map(f => f.replace('.yml', ''))
    expect(codes.sort()).toEqual(files.sort())
    expect(codes).toContain('en')
  })

  it.each(codes.filter(c => c !== 'en'))('%s has the same keys as en', code => {
    const keys = Object.keys(strings[code])
    expect(_.difference(enKeys, keys)).toEqual([])
    expect(_.difference(keys, enKeys)).toEqual([])
  })

  it.each(codes.filter(c => c !== 'en'))('%s keeps the placeholders of en', code => {
    const mismatches = enKeys.filter(key => !_.isEqual(placeholders(strings.en[key]), placeholders(strings[code][key])))
    expect(mismatches).toEqual([])
  })

  it('has no empty strings', () => {
    for (const code of codes) {
      expect(_.keys(_.pickBy(strings[code], v => _.isString(v) && _.trim(v) === ''))).toEqual([])
    }
  })
})

describe('translation keys used in the code', () => {
  const SOURCES = ['client', 'server/views', 'server/controllers', 'server/core', 'server/graph', 'server/helpers', 'server/jobs', 'server/models', 'dev/templates']
  const files = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full)
      } else if (/\.(vue|js|pug)$/.test(entry.name)) {
        files.push(full)
      }
    }
  }
  SOURCES.forEach(dir => walk(path.join(ROOT, dir)))

  it('exist in en', () => {
    const missing = []
    let checked = 0
    // -> Literal keys only, e.g. $t('common:header.login') or t(`admin:pages.title`);
    //    keys built at runtime ('admin:utilities.' + key) are skipped
    const keyRegex = /\bt\(\s*(['"`])([a-z]+):([\w-]+(?:\.[\w-]+)*)\1/g
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8')
      for (const [, , ns, key] of src.matchAll(keyRegex)) {
        const fullKey = `${ns}.${key}`
        checked++
        if (!(fullKey in strings.en) && !(`${fullKey}_plural` in strings.en)) {
          missing.push(`${fullKey} (${path.relative(ROOT, file)})`)
        }
      }
    }
    expect(checked).toBeGreaterThan(500)
    expect(_.uniq(missing)).toEqual([])
  })
})
