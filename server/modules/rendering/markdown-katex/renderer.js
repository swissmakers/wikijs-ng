const katex = require('katex')
const mathHelper = require('../../../helpers/markdown-math')

/* global WIKI */

// ------------------------------------
// Markdown - KaTeX Renderer
// ------------------------------------
//
// Includes code from https://github.com/liradb2000/markdown-it-katex

// Adds the \ce, \pu and \tripledash macros (mhchem)
require('katex/dist/contrib/mhchem.js')

module.exports = {
  init (mdinst, conf) {
    const macros = {}
    if (conf.useInline) {
      mdinst.inline.ruler.after('escape', 'katex_inline', mathHelper.inlineRule('katex_inline'))
      mdinst.renderer.rules.katex_inline = (tokens, idx) => {
        try {
          return katex.renderToString(tokens[idx].content, {
            displayMode: false, macros
          })
        } catch (err) {
          WIKI.logger.warn(err)
          return tokens[idx].content
        }
      }
    }
    if (conf.useBlocks) {
      mdinst.block.ruler.after('blockquote', 'katex_block', mathHelper.blockRule('katex_block'), {
        alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
      })
      mdinst.renderer.rules.katex_block = (tokens, idx) => {
        try {
          return `<p>` + katex.renderToString(tokens[idx].content, {
            displayMode: true, macros
          }) + `</p>`
        } catch (err) {
          WIKI.logger.warn(err)
          return tokens[idx].content
        }
      }
    }
  }
}
