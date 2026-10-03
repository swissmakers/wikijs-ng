import pako from 'pako'
import { diagramFence, plantumlEncode, splitKrokiSource } from '../../../../server/helpers/markdown-fence'

// ------------------------------------
// Markdown - Diagram preview (PlantUML / Kroki)
// ------------------------------------
//
// Mirrors server/modules/rendering/markdown-{plantuml,kroki}/renderer.js,
// using pako instead of zlib. Configured from the renderer settings (siteConfig.editorIntegrations).

export function plantumlPreview (md, conf) {
  const imageFormat = conf.imageFormat || 'svg'
  const server = conf.server || 'https://www.plantuml.com/plantuml'
  diagramFence(md, {
    name: 'uml_diagram',
    openMarker: conf.openMarker || '```plantuml',
    closeMarker: conf.closeMarker || '```',
    getImageSrc: contents => {
      const zippedCode = plantumlEncode(pako.deflateRaw('@startuml\n' + contents + '\n@enduml', { to: 'string' }))
      return `${server}/${imageFormat}/${zippedCode}`
    }
  })
}

export function krokiPreview (md, conf) {
  const server = conf.server || 'https://kroki.io'
  diagramFence(md, {
    name: 'kroki',
    openMarker: conf.openMarker || '```kroki',
    closeMarker: conf.closeMarker || '```',
    getImageSrc: contents => {
      const { diagramType, source } = splitKrokiSource(contents)
      const result = btoa(pako.deflate(source, { to: 'string' })).replace(/\+/g, '-').replace(/\//g, '_')
      return `${server}/${diagramType}/svg/${result}`
    }
  })
}
