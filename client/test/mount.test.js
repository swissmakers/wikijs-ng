const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!DOCTYPE html><body></body>')
global.Node = dom.window.Node
const { serverRenderedRoot } = require('../helpers/mount')

// -> Stand-in for Vue's createElement: plain objects, scoped slots resolved eagerly
const h = (tag, data = {}, children = []) => ({
  tag,
  attrs: data.attrs,
  html: data.domProps && data.domProps.innerHTML,
  slots: data.scopedSlots && Object.fromEntries(Object.entries(data.scopedSlots).map(([name, fn]) => [name, fn()])),
  children
})

const mount = (html, opts = {}) => {
  const doc = new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document
  return serverRenderedRoot(doc.getElementById('root'), {
    isComponent: tag => ['page', 'page-source'].includes(tag),
    slotRules: { page: { contents: ['tabset'], comments: ['comments'] } },
    ...opts
  })(h)
}

describe('helpers/mount/serverRenderedRoot', () => {
  it('keeps the mount point and passes bound props as JSON', () => {
    const root = mount('<div id="root" class="is-fullscreen"><page locale="de" :page-id="12" :tags=\'["a","b"]\' :is-published="true" comments-enabled effective-permissions="e30="></page></div>')
    expect(root).toMatchObject({ tag: 'div', attrs: { id: 'root', class: 'is-fullscreen' } })
    const page = root.children[0]
    expect(page.tag).toBe('page')
    expect(page.attrs).toEqual({ locale: 'de', 'page-id': 12, tags: ['a', 'b'], 'is-published': true, 'comments-enabled': '', 'effective-permissions': 'e30=' })
  })

  it('turns slot templates into named slots and keeps page content static', () => {
    const root = mount('<div id="root"><page><template slot="contents"><div><h1>Title {{ constructor.constructor(\'alert(1)\')() }}</h1><comments></comments><p v-pre>x</p></div></template><template slot="comments"><div><comments></comments></div></template></page></div>')
    const page = root.children[0]
    // -> Page content is rendered as HTML, never compiled: no components, no template expressions
    expect(page.slots.contents).toHaveLength(1)
    expect(page.slots.contents[0].tag).toBe('div')
    expect(page.slots.contents[0].html).toContain("{{ constructor.constructor('alert(1)')() }}")
    expect(page.slots.contents[0].html).toContain('<comments></comments>')
    // -> The comments slot may mount the comments component
    expect(page.slots.comments[0].children[0].tag).toBe('comments')
  })

  it('mounts tabsets inside page content with their named slots', () => {
    const root = mount('<div id="root"><page><template slot="contents"><div><p>Intro</p><tabset><template v-slot:tabs><li>One</li><li>Two</li></template><template v-slot:content><div class="tabset-panel">1</div><div class="tabset-panel">2</div></template></tabset></div></template></page></div>')
    const content = root.children[0].slots.contents[0]
    expect(content.children[0]).toMatchObject({ tag: 'p', html: 'Intro' })
    const tabset = content.children[1]
    expect(tabset.tag).toBe('tabset')
    expect(tabset.slots.tabs.map(n => n.html)).toEqual(['One', 'Two'])
    expect(tabset.slots.content.map(n => n.attrs.class)).toEqual(['tabset-panel', 'tabset-panel'])
  })

  it('passes default slot content and static roots through', () => {
    const source = mount('<div id="root"><page-source :page-id="3"><code v-pre>&lt;b&gt;</code></page-source></div>').children[0]
    expect(source.slots.default[0]).toMatchObject({ tag: 'code', html: '&lt;b&gt;' })
    const error = mount('<div id="root"><div class="app-error"><strong>Oops</strong></div></div>')
    expect(error.children[0]).toMatchObject({ tag: 'div', html: '<strong>Oops</strong>' })
  })
})
