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
