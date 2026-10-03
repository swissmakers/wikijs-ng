const _ = require('lodash')

/* global WIKI */

const NONCE = '{nonce}'

/**
 * Default Content-Security-Policy.
 * - 'strict-dynamic' trusts scripts loaded by nonced scripts (webpack chunks, Prism, analytics loaders)
 * - no 'unsafe-eval': the client mounts the server markup with render functions (client/helpers/mount.js)
 * - inline styles are needed by Vuetify, mermaid and rendered content
 */
const DEFAULT_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", `'nonce-${NONCE}'`, "'strict-dynamic'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-src': ["'self'", 'https:'],
  'media-src': ["'self'", 'data:', 'blob:', 'https:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"]
}

const ICONSET_SOURCES = {
  fa: 'https://use.fontawesome.com',
  fa4: 'https://cdn.jsdelivr.net'
}

/**
 * Origin of an http(s) URL, or null when the URL is invalid
 */
const httpOrigin = url => {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : null
  } catch (err) {
    return null
  }
}

module.exports = {
  NONCE,
  httpOrigin,
  /**
   * Frame sources required by the configured integrations (draw.io editor)
   *
   * @param {Object} config Site configuration (WIKI.config)
   * @returns {Array<string>} Origins
   */
  integrationFrameSources (config) {
    return _.compact([httpOrigin(_.get(config, 'integrations.drawioUrl'))])
  },
  /**
   * Parse custom directives: one directive per line, e.g. "connect-src https://analytics.example.com"
   *
   * @param {string} raw Custom directives
   * @returns {Object} Directive name -> sources
   */
  parseDirectives (raw) {
    return _.transform(_.split(raw || '', /[\r\n;]+/), (result, line) => {
      const parts = _.compact(_.trim(line).split(/\s+/))
      if (parts.length > 0 && /^[a-z-]+$/i.test(parts[0])) {
        const name = parts[0].toLowerCase()
        result[name] = _.uniq([...(result[name] || []), ...parts.slice(1)])
      }
    }, {})
  },
  /**
   * Build the Content-Security-Policy header
   *
   * @param {Object} opts Options
   * @param {string} [opts.nonce] Per-request nonce (the {nonce} placeholder is kept when omitted)
   * @param {Object} opts.security Security settings (securityCSPReportOnly, securityCSPDirectives, securityIframe)
   * @param {string} [opts.iconset] Icon set (Font Awesome sets are loaded from a CDN)
   * @param {Array<string>} [opts.frameSources] Additional frame sources (e.g. the draw.io origin)
   * @returns {Object} { headerName, value }
   */
  buildPolicy ({ nonce = NONCE, security = {}, iconset = 'mdi', frameSources = [] }) {
    const directives = _.cloneDeep(DEFAULT_DIRECTIVES)
    const add = (name, sources) => {
      directives[name] = _.uniq([...(directives[name] || []), ..._.compact(sources)])
    }
    if (ICONSET_SOURCES[iconset]) {
      add('style-src', [ICONSET_SOURCES[iconset]])
      add('font-src', [ICONSET_SOURCES[iconset]])
    }
    add('frame-src', frameSources)
    if (security.securityIframe) {
      add('frame-ancestors', ["'none'"])
    }
    _.forOwn(module.exports.parseDirectives(security.securityCSPDirectives), (sources, name) => add(name, sources))

    const value = _.map(directives, (sources, name) => _.trim(`${name} ${sources.join(' ')}`))
      .join('; ')
      .split(NONCE).join(nonce)
    return {
      headerName: security.securityCSPReportOnly === false ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only',
      value
    }
  },
  /**
   * Add the nonce to every <script> tag of an HTML snippet that has none
   *
   * @param {string} html HTML snippet
   * @param {string} nonce Nonce
   * @returns {string} HTML snippet
   */
  addNonce (html, nonce) {
    if (!html || !nonce) {
      return html
    }
    return html.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`)
  },
  /**
   * Add the request nonce to the script tags of code snippets (theme / page injection,
   * analytics, comment providers) when the CSP is enabled
   *
   * @param {Object} snippets Snippets by key (non-string values are kept)
   * @param {Object} res Express response (res.locals.nonce)
   * @returns {Object} New object with the nonced snippets
   */
  nonceSnippets (snippets, res) {
    if (!WIKI.config.security.securityCSP) {
      return snippets
    }
    return _.mapValues(snippets, v => _.isString(v) ? module.exports.addNonce(v, res.locals.nonce) : v)
  }
}
