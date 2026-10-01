const dbEngine = require('../../modules/search/db/engine')
const mariadbEngine = require('../../modules/search/mariadb/engine')

describe('search/db/tokenize', () => {
  it('splits on whitespace and drops empty tokens', () => {
    expect(dbEngine.tokenize('  install   docker\tcompose ')).toEqual(['install', 'docker', 'compose'])
    expect(dbEngine.tokenize('')).toEqual([])
    expect(dbEngine.tokenize(null)).toEqual([])
  })
})

describe('search/mariadb/buildBooleanQuery', () => {
  it('requires every word as a prefix match', () => {
    expect(mariadbEngine.buildBooleanQuery('install docker')).toBe('+install* +docker*')
  })

  it('removes boolean operators and too short words', () => {
    expect(mariadbEngine.buildBooleanQuery('-foo +bar* "baz" (q) a ~x@y')).toBe('+foo* +bar* +baz* +xy*')
    expect(mariadbEngine.buildBooleanQuery('+ - a')).toBe('')
  })
})
