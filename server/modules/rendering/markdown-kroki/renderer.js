const zlib = require('zlib')
const { diagramFence, splitKrokiSource } = require('../../../helpers/markdown-fence')

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
        const { diagramType, source } = splitKrokiSource(contents)
        const result = zlib.deflateSync(source).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
        return `${server}/${diagramType}/svg/${result}`
      }
    })
  }
}
