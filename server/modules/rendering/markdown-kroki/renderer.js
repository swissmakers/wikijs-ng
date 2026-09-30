const zlib = require('zlib')
const { diagramFence } = require('../../../helpers/markdown-fence')

// ------------------------------------
// Markdown - Kroki Preprocessor
// ------------------------------------

module.exports = {
  init (mdinst, conf) {
    const server = conf.server || 'https://kroki.io'
    diagramFence(mdinst, {
      name: 'kroki',
      openMarker: conf.openMarker || '```kroki',
      closeMarker: conf.closeMarker || '```',
      getImageSrc: contents => {
        // -> First line is the diagram type (e.g. graphviz, mermaid)
        let firstlf = contents.indexOf('\n')
        if (firstlf === -1) firstlf = undefined
        const diagramType = contents.substring(0, firstlf)
        const source = contents.substring(firstlf + 1)
        const result = zlib.deflateSync(source).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
        return `${server}/${diagramType}/svg/${result}`
      }
    })
  }
}
