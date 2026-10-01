const zlib = require('zlib')
const { diagramFence, plantumlEncode } = require('../../../helpers/markdown-fence')

// ------------------------------------
// Markdown - PlantUML Preprocessor
// ------------------------------------

module.exports = {
  init (mdinst, conf) {
    const imageFormat = conf.imageFormat || 'svg'
    const server = conf.server || 'https://www.plantuml.com/plantuml'
    diagramFence(mdinst, {
      name: 'uml_diagram',
      openMarker: conf.openMarker || '```plantuml',
      closeMarker: conf.closeMarker || '```',
      getImageSrc: contents => {
        const zippedCode = plantumlEncode(zlib.deflateRawSync('@startuml\n' + contents + '\n@enduml').toString('binary'))
        return `${server}/${imageFormat}/${zippedCode}`
      }
    })
  }
}
