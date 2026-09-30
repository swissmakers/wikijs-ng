const katex = require('katex')
const mathHelper = require('../../../helpers/markdown-math')
const chemParse = require('./mhchem')

/* global WIKI */

// ------------------------------------
// Markdown - KaTeX Renderer
// ------------------------------------
//
// Includes code from https://github.com/liradb2000/markdown-it-katex

// Add \ce, \pu, and \tripledash to the KaTeX macros.
katex.__defineMacro('\\ce', function(context) {
  return chemParse(context.consumeArgs(1)[0], 'ce')
})
katex.__defineMacro('\\pu', function(context) {
  return chemParse(context.consumeArgs(1)[0], 'pu')
})

//  Needed for \bond for the ~ forms
//  Raise by 2.56mu, not 2mu. We're raising a hyphen-minus, U+002D, not
//  a mathematical minus, U+2212. So we need that extra 0.56.
katex.__defineMacro('\\tripledash', '{\\vphantom{-}\\raisebox{2.56mu}{$\\mkern2mu' + '\\tiny\\text{-}\\mkern1mu\\text{-}\\mkern1mu\\text{-}\\mkern2mu$}}')

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
