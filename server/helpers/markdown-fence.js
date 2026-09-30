// ------------------------------------
// Markdown - Diagram fence helper
// ------------------------------------
//
// Shared by the PlantUML and Kroki renderers: turns a fenced block
// (e.g. ```plantuml ... ```) into an <img> token pointing to a diagram server.

module.exports = {
  /**
   * Register a block rule rendering a fenced diagram as an image
   *
   * @param {Object} md markdown-it instance
   * @param {Object} opts Options
   * @param {string} opts.name Rule / token name
   * @param {string} opts.openMarker Opening fence (e.g. ```plantuml)
   * @param {string} opts.closeMarker Closing fence (e.g. ```)
   * @param {Function} opts.getImageSrc (contents) => image URL for the diagram source
   */
  diagramFence (md, { name, openMarker, closeMarker, getImageSrc }) {
    const openChar = openMarker.charCodeAt(0)
    const closeChar = closeMarker.charCodeAt(0)

    md.block.ruler.before('fence', name, (state, startLine, endLine, silent) => {
      let nextLine
      let markup
      let params
      let token
      let i
      let autoClosed = false
      let start = state.bMarks[startLine] + state.tShift[startLine]
      let max = state.eMarks[startLine]

      // Check out the first character quickly,
      // this should filter out most of non-uml blocks
      //
      if (openChar !== state.src.charCodeAt(start)) { return false }

      // Check out the rest of the marker string
      //
      for (i = 0; i < openMarker.length; ++i) {
        if (openMarker[i] !== state.src[start + i]) { return false }
      }

      markup = state.src.slice(start, start + i)
      params = state.src.slice(start + i, max)

      // Since start is found, we can report success here in validation mode
      //
      if (silent) { return true }

      // Search for the end of the block
      //
      nextLine = startLine

      for (;;) {
        nextLine++
        if (nextLine >= endLine) {
          // unclosed block should be autoclosed by end of document.
          // also block seems to be autoclosed by end of parent
          break
        }

        start = state.bMarks[nextLine] + state.tShift[nextLine]
        max = state.eMarks[nextLine]

        if (start < max && state.sCount[nextLine] < state.blkIndent) {
          // non-empty line with negative indent should stop the list:
          // - ```
          //  test
          break
        }

        if (closeChar !== state.src.charCodeAt(start)) {
          // didn't find the closing fence
          continue
        }

        if (state.sCount[nextLine] > state.sCount[startLine]) {
          // closing fence should not be indented with respect of opening fence
          continue
        }

        let closeMarkerMatched = true
        for (i = 0; i < closeMarker.length; ++i) {
          if (closeMarker[i] !== state.src[start + i]) {
            closeMarkerMatched = false
            break
          }
        }

        if (!closeMarkerMatched) {
          continue
        }

        // make sure tail has spaces only
        if (state.skipSpaces(start + i) < max) {
          continue
        }

        // found!
        autoClosed = true
        break
      }

      const contents = state.src
        .split('\n')
        .slice(startLine + 1, nextLine)
        .join('\n')

      // We generate a token list for the alt property, to mimic what the image parser does.
      let altToken = []
      // Remove leading space if any.
      let alt = params ? params.slice(1) : 'uml diagram'
      state.md.inline.parse(
        alt,
        state.md,
        state.env,
        altToken
      )

      token = state.push(name, 'img', 0)
      // alt is constructed from children. No point in populating it here.
      token.attrs = [ [ 'src', getImageSrc(contents) ], [ 'alt', '' ], ['class', 'uml-diagram prefetch-candidate'] ]
      token.block = true
      token.children = altToken
      token.info = params
      token.map = [ startLine, nextLine ]
      token.markup = markup

      state.line = nextLine + (autoClosed ? 1 : 0)

      return true
    }, {
      alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
    })
    md.renderer.rules[name] = md.renderer.rules.image
  }
}
