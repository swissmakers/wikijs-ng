const auth = require('../../core/auth')

const rule = (id, match, path, { deny = false, roles = ['read:pages'], locales = [] } = {}) => ({ id, deny, match, path, roles, locales })

const setGroups = groups => {
  global.WIKI = { auth: { groups } }
}

const user = (groups, permissions = ['read:pages']) => ({ id: 10, permissions, groups })

const page = (path, { locale = 'en', tags = [] } = {}) => ({ path, locale, tags: tags.map(tag => ({ tag })) })

describe('core/auth/checkAccess', () => {
  afterEach(() => {
    delete global.WIKI
  })

  it('grants everything to manage:system', () => {
    setGroups({})
    expect(auth.checkAccess(user([], ['manage:system']), ['delete:pages'], page('any'))).toBe(true)
  })

  it('denies without the global permission', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', '')] } })
    expect(auth.checkAccess(user([1], ['read:pages']), ['write:pages'], page('home'))).toBe(false)
  })

  it('only checks global permissions when no page is given', () => {
    setGroups({})
    expect(auth.checkAccess(user([], ['read:pages']), ['read:pages'])).toBe(true)
  })

  it('denies when the user has no groups', () => {
    setGroups({})
    expect(auth.checkAccess({ id: 10, permissions: ['read:pages'] }, ['read:pages'], page('home'))).toBe(false)
  })

  it('matches START rules on path prefixes', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', 'docs')] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/install'))).toBe(true)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('blog/post'))).toBe(false)
  })

  it('matches END, REGEX and EXACT rules', () => {
    setGroups({
      1: {
        pageRules: [
          rule('a', 'END', '/faq'),
          rule('b', 'REGEX', '^guides/[0-9]+$'),
          rule('c', 'EXACT', 'home')
        ]
      }
    })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('product/faq'))).toBe(true)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('guides/42'))).toBe(true)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('guides/abc'))).toBe(false)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('home'))).toBe(true)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('home/sub'))).toBe(false)
  })

  it('matches TAG rules against page tags', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', ''), rule('b', 'TAG', 'secret', { deny: true })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/a', { tags: ['secret'] }))).toBe(false)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/a', { tags: ['public'] }))).toBe(true)
  })

  it('ignores rules for other roles', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', '', { roles: ['write:pages'] })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('home'))).toBe(false)
  })

  it('ignores rules restricted to other locales', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', '', { locales: ['de'] })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('home', { locale: 'en' }))).toBe(false)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('home', { locale: 'de' }))).toBe(true)
  })

  it('lets the more specific (longer) rule win', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', ''), rule('b', 'START', 'private', { deny: true })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('private/x'))).toBe(false)
    expect(auth.checkAccess(user([1]), ['read:pages'], page('public/x'))).toBe(true)
  })

  it('prefers EXACT over START for rules of the same length', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', 'docs/a'), rule('b', 'EXACT', 'docs/a', { deny: true })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/a'))).toBe(false)
    setGroups({ 1: { pageRules: [rule('a', 'EXACT', 'docs/a'), rule('b', 'START', 'docs/a', { deny: true })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/a'))).toBe(true)
  })

  it('lets deny win over allow for identical rules, in any order', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', 'docs'), rule('b', 'START', 'docs', { deny: true })] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/a'))).toBe(false)
    setGroups({ 1: { pageRules: [rule('b', 'START', 'docs', { deny: true }), rule('a', 'START', 'docs')] } })
    expect(auth.checkAccess(user([1]), ['read:pages'], page('docs/a'))).toBe(false)
  })

  it('combines the rules of all groups of the user', () => {
    setGroups({
      1: { pageRules: [rule('a', 'START', '')] },
      2: { pageRules: [rule('b', 'START', 'hr', { deny: true })] }
    })
    expect(auth.checkAccess(user([1, 2]), ['read:pages'], page('hr/salaries'))).toBe(false)
    expect(auth.checkAccess(user([1, 2]), ['read:pages'], page('docs'))).toBe(true)
    expect(auth.checkAccess(user([{ id: 1 }]), ['read:pages'], page('hr/salaries'))).toBe(true)
  })
})

describe('core/auth/explainAccess', () => {
  afterEach(() => {
    delete global.WIKI
  })

  it('reports admin, missing global permission and missing rules', () => {
    setGroups({ 1: { pageRules: [rule('a', 'START', 'docs')] } })
    expect(auth.explainAccess(user([], ['manage:system']), 'read:pages', page('x')).reason).toBe('ADMIN')
    expect(auth.explainAccess(user([1], ['read:pages']), 'write:pages', page('docs/a')).reason).toBe('NO_GLOBAL')
    expect(auth.explainAccess(user([1]), 'read:pages', page('blog'))).toMatchObject({ allowed: false, reason: 'NO_RULE' })
  })

  it('names the deciding rule and group', () => {
    setGroups({
      1: { pageRules: [rule('a', 'START', '')] },
      2: { pageRules: [rule('b', 'START', 'hr', { deny: true })] }
    })
    const result = auth.explainAccess(user([1, 2]), 'read:pages', page('hr/salaries'))
    expect(result).toMatchObject({ allowed: false, reason: 'RULE', groupId: 2 })
    expect(result.rule.id).toBe('b')
  })

  it('agrees with checkAccess', () => {
    setGroups({
      1: { pageRules: [rule('a', 'START', 'docs'), rule('b', 'EXACT', 'docs/private', { deny: true }), rule('c', 'TAG', 'draft', { deny: true })] },
      2: { pageRules: [rule('d', 'END', '/public'), rule('e', 'REGEX', '^kb/[0-9]+$')] }
    })
    const pages = [page('docs'), page('docs/private'), page('docs/a', { tags: ['draft'] }), page('x/public'), page('kb/12'), page('kb/x'), page('other')]
    for (const p of pages) {
      const u = user([1, 2])
      expect(auth.explainAccess(u, 'read:pages', p).allowed).toBe(auth.checkAccess(u, ['read:pages'], p))
    }
  })
})
