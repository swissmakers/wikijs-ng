const MarkdownIt = require('markdown-it')

global.WIKI = { logger: { warn: () => {} } }

const kroki = require('../../modules/rendering/markdown-kroki/renderer')
const plantuml = require('../../modules/rendering/markdown-plantuml/renderer')
const katex = require('../../modules/rendering/markdown-katex/renderer')
const mathjax = require('../../modules/rendering/markdown-mathjax/renderer')

const DIAGRAM_DOC = [
  'Intro',
  '',
  '```kroki',
  'graphviz',
  'digraph G { a -> b }',
  '```',
  '',
  '```plantuml',
  'Alice -> Bob: hello',
  '```',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  '- list item',
  '  ```plantuml',
  '  Bob -> Alice: indented',
  '  ```',
  '',
  '```plantuml',
  'unclosed -> fence'
].join('\n')

const MATH_DOC = [
  'Inline $x^2 + y_1$ and escaped \\$5 and $ not math $.',
  '',
  'Price is $5 and $10.',
  '',
  '$$',
  '\\frac{a}{b}',
  '$$',
  '',
  '$$ e = mc^2 $$',
  '',
  '> $$',
  '> \\sqrt{2}',
  '> $$'
].join('\n')

describe('rendering/markdown diagram fences', () => {
  it('renders kroki fences (default config)', () => {
    const md = new MarkdownIt()
    kroki.init(md, {})
    expect(md.render(DIAGRAM_DOC)).toMatchSnapshot()
  })

  it('renders kroki fences (custom server and markers)', () => {
    const md = new MarkdownIt()
    kroki.init(md, { server: 'https://kroki.example.com', openMarker: '~~~diagram', closeMarker: '~~~' })
    expect(md.render('~~~diagram\nmermaid\ngraph TD; A-->B\n~~~\n')).toMatchSnapshot()
  })

  it('renders plantuml fences (default config)', () => {
    const md = new MarkdownIt()
    plantuml.init(md, {})
    expect(md.render(DIAGRAM_DOC)).toMatchSnapshot()
  })

  it('renders plantuml fences (custom server and format)', () => {
    const md = new MarkdownIt()
    plantuml.init(md, { server: 'https://uml.example.com', imageFormat: 'png' })
    expect(md.render('```plantuml\nA -> B\n```\n')).toMatchSnapshot()
  })
})

describe('editor diagram preview', () => {
  // -> The editor preview (pako) must produce the same diagrams as the server renderers (zlib).
  //    The compressed bytes may differ between implementations, so compare the decoded sources.
  const zlib = require('zlib')
  const { plantumlPreview, krokiPreview } = require('../../../client/components/editor/markdown/diagrams')
  const DOC = '```plantuml\nAlice -> Bob: héllo\n```\n\n```kroki\ngraphviz\ndigraph G { a -> b }\n```\n'
  const PLANTUML_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

  const decodePlantuml = encoded => {
    const bytes = []
    for (let i = 0; i < encoded.length; i += 4) {
      const [c1, c2, c3, c4] = encoded.slice(i, i + 4).split('').map(c => PLANTUML_ALPHABET.indexOf(c))
      bytes.push((c1 << 2) | (c2 >> 4), ((c2 & 0xF) << 4) | (c3 >> 2), ((c3 & 0x3) << 6) | c4)
    }
    // -> Trailing padding bytes are ignored by inflate
    return zlib.inflateRawSync(Buffer.from(bytes), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString()
  }
  const decodeKroki = encoded => zlib.inflateSync(Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toString()
  const diagrams = html => [...html.matchAll(/src="([^"]+)\/([^"/]+)"/g)].map(([, prefix, payload]) => ({
    prefix,
    source: prefix.includes('kroki') ? decodeKroki(payload) : decodePlantuml(payload)
  }))

  it('matches the server output', () => {
    const serverMd = new MarkdownIt()
    plantuml.init(serverMd, { server: 'https://uml.example.com', imageFormat: 'png' })
    kroki.init(serverMd, {})
    const clientMd = new MarkdownIt()
    plantumlPreview(clientMd, { server: 'https://uml.example.com', imageFormat: 'png' })
    krokiPreview(clientMd, {})

    const expected = diagrams(serverMd.render(DOC))
    expect(expected).toEqual([
      { prefix: 'https://uml.example.com/png', source: '@startuml\nAlice -> Bob: héllo\n@enduml' },
      { prefix: 'https://kroki.io/graphviz/svg', source: 'digraph G { a -> b }' }
    ])
    expect(diagrams(clientMd.render(DOC))).toEqual(expected)
  })
})

describe('rendering/markdown math', () => {
  it('renders katex inline and block math', () => {
    const md = new MarkdownIt()
    katex.init(md, { useInline: true, useBlocks: true })
    expect(md.render(MATH_DOC)).toMatchSnapshot()
  })

  it('renders mathjax inline and block math', async () => {
    const md = new MarkdownIt()
    await mathjax.init(md, { useInline: true, useBlocks: true })
    expect(md.render(MATH_DOC)).toMatchSnapshot()
  }, 30000)
})
