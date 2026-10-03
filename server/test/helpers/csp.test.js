const csp = require('../../helpers/csp')

const directive = (value, name) => value.split('; ').find(d => d.startsWith(`${name} `))

describe('helpers/csp/buildPolicy', () => {
  it('builds a report-only policy by default with the nonce', () => {
    const policy = csp.buildPolicy({ nonce: 'abc123', security: {} })
    expect(policy.headerName).toBe('Content-Security-Policy-Report-Only')
    expect(directive(policy.value, 'script-src')).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'")
    expect(directive(policy.value, 'object-src')).toBe("object-src 'none'")
    expect(policy.value).not.toContain('frame-ancestors')
  })

  it('enforces when report-only is turned off', () => {
    expect(csp.buildPolicy({ security: { securityCSPReportOnly: false } }).headerName).toBe('Content-Security-Policy')
  })

  it('keeps the placeholder when no nonce is given (preview)', () => {
    expect(csp.buildPolicy({ security: {} }).value).toContain("'nonce-{nonce}'")
  })

  it('forbids framing when iframe protection is enabled', () => {
    expect(directive(csp.buildPolicy({ security: { securityIframe: true } }).value, 'frame-ancestors')).toBe("frame-ancestors 'none'")
  })

  it('allows the Font Awesome CDN for the fa icon sets', () => {
    const value = csp.buildPolicy({ security: {}, iconset: 'fa' }).value
    expect(directive(value, 'style-src')).toContain('https://use.fontawesome.com')
    expect(directive(value, 'font-src')).toContain('https://use.fontawesome.com')
  })

  it('merges custom directives and extra frame sources', () => {
    const value = csp.buildPolicy({
      security: { securityCSPDirectives: "connect-src https://stats.example.com\nworker-src 'self' blob:\nconnect-src 'self'" },
      frameSources: ['https://draw.example.com']
    }).value
    expect(directive(value, 'connect-src')).toBe("connect-src 'self' https://stats.example.com")
    expect(directive(value, 'worker-src')).toBe("worker-src 'self' blob:")
    expect(directive(value, 'frame-src')).toContain('https://draw.example.com')
  })
})

describe('helpers/csp/parseDirectives', () => {
  it('ignores empty and invalid lines', () => {
    expect(csp.parseDirectives("\n  \nimg-src https://cdn.example.com;\n'bad' line")).toEqual({ 'img-src': ['https://cdn.example.com'] })
  })
})

describe('helpers/csp/addNonce', () => {
  it('adds the nonce to script tags without one', () => {
    const html = '<script src="a.js"></script><SCRIPT>x()</SCRIPT><script nonce="old">y()</script><style>p{}</style>'
    expect(csp.addNonce(html, 'n1')).toBe('<script nonce="n1" src="a.js"></script><script nonce="n1">x()</SCRIPT><script nonce="old">y()</script><style>p{}</style>')
  })

  it('returns empty snippets unchanged', () => {
    expect(csp.addNonce('', 'n1')).toBe('')
    expect(csp.addNonce('<script></script>', '')).toBe('<script></script>')
  })
})

describe('helpers/csp/integrationFrameSources', () => {
  it('allows the configured draw.io origin', () => {
    expect(csp.integrationFrameSources({ integrations: { drawioUrl: 'http://drawio.lan:8080/app/' } })).toEqual(['http://drawio.lan:8080'])
    expect(csp.integrationFrameSources({ integrations: { drawioUrl: 'javascript:alert(1)' } })).toEqual([])
    expect(csp.integrationFrameSources({})).toEqual([])
  })
})
