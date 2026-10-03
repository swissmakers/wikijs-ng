// ------------------------------------
// Mount server-rendered components without the Vue template compiler
// ------------------------------------
//
// The server views render a mount point such as
//
//   <div id="root" class="is-fullscreen">
//     <page locale="en" :page-id="12" :tags='["a"]'>
//       <template slot="contents"><div>...page HTML...</div></template>
//     </page>
//   </div>
//
// Instead of compiling this markup as a template in the browser (which needs
// 'unsafe-eval' in the Content-Security-Policy and would also evaluate any
// template syntax inside page content), it is read once into a description
// and rendered with a render function:
//
// - `:prop` attribute values are JSON, other attributes are passed as strings
// - <template slot="x"> / <template v-slot:x> children become named slots
// - only allowed tags become components (registered components at the root,
//   the tags listed per slot below it); everything else stays static HTML

const SLOT_DIRECTIVE = /^(?:v-slot:|#)(.+)$/

function parseBoundValue (value, name) {
  try {
    return JSON.parse(value)
  } catch (err) {
    console.warn(`Mount: attribute ${name} is not valid JSON, passing it as a string.`)
    return value
  }
}

function childNodesOf (el) {
  return Array.from(el.localName === 'template' ? el.content.childNodes : el.childNodes)
}

function hasAllowedDescendant (el, isAllowed) {
  for (const node of childNodesOf(el)) {
    if (node.nodeType === Node.ELEMENT_NODE && (isAllowed(node.localName) || hasAllowedDescendant(node, isAllowed))) {
      return true
    }
  }
  return false
}

function plainAttrs (el) {
  const attrs = {}
  for (const attr of el.attributes) {
    attrs[attr.name] = attr.value
  }
  return attrs
}

/**
 * Read DOM nodes into render descriptions
 *
 * @param {Array<Node>} nodes DOM nodes
 * @param {Function} isAllowed (tag) => whether the tag is mounted as a component
 * @param {Object} slotRules Allowed component tags per slot name, per component tag
 */
function describeNodes (nodes, isAllowed, slotRules) {
  const result = []
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      result.push({ type: 'text', text: node.textContent })
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (isAllowed(node.localName)) {
        result.push(describeComponent(node, slotRules))
      } else if (hasAllowedDescendant(node, isAllowed)) {
        result.push({ type: 'element', tag: node.localName, attrs: plainAttrs(node), children: describeNodes(childNodesOf(node), isAllowed, slotRules) })
      } else {
        result.push({ type: 'static', tag: node.localName, attrs: plainAttrs(node), html: node.innerHTML })
      }
    }
  }
  return result
}

function describeComponent (el, slotRules) {
  const tag = el.localName
  const attrs = {}
  let staticClass = null
  for (const attr of el.attributes) {
    if (attr.name.startsWith(':') || attr.name.startsWith('v-bind:')) {
      const name = attr.name.replace(/^(v-bind)?:/, '')
      attrs[name] = parseBoundValue(attr.value, name)
    } else if (attr.name === 'class') {
      staticClass = attr.value
    } else if (!attr.name.startsWith('v-') && attr.name !== 'slot') {
      attrs[attr.name] = attr.value
    }
  }

  // -> Group children into slots
  const rules = slotRules[tag] || {}
  const allowedIn = name => {
    const allowed = rules[name] || []
    return childTag => allowed.includes(childTag)
  }
  const slots = {}
  const addToSlot = (name, nodes) => {
    slots[name] = [...(slots[name] || []), ...describeNodes(nodes, allowedIn(name), slotRules)]
  }
  for (const node of Array.from(el.childNodes)) {
    let slotName = 'default'
    if (node.nodeType === Node.ELEMENT_NODE) {
      const directive = Array.from(node.attributes).map(a => a.name.match(SLOT_DIRECTIVE)).find(Boolean)
      slotName = node.getAttribute('slot') || (directive && directive[1]) || 'default'
      if (node.localName === 'template') {
        addToSlot(slotName, childNodesOf(node))
        continue
      }
    }
    addToSlot(slotName, [node])
  }
  return { type: 'component', tag, attrs, staticClass, slots }
}

function render (h, desc) {
  switch (desc.type) {
    case 'text':
      return desc.text
    case 'static':
      return h(desc.tag, { attrs: desc.attrs, domProps: { innerHTML: desc.html } })
    case 'element':
      return h(desc.tag, { attrs: desc.attrs }, desc.children.map(child => render(h, child)))
    case 'component': {
      const scopedSlots = {}
      for (const [name, children] of Object.entries(desc.slots)) {
        scopedSlots[name] = () => children.map(child => render(h, child))
      }
      // -> extractProps takes the declared props out of attrs (by hyphenated name)
      return h(desc.tag, { attrs: { ...desc.attrs }, staticClass: desc.staticClass, scopedSlots })
    }
  }
}

/**
 * Prepare a render function for a server-rendered mount point
 *
 * @param {HTMLElement} el Mount point (e.g. #root)
 * @param {Object} opts Options
 * @param {Function} opts.isComponent (tag) => whether a root-level tag is a registered component
 * @param {Object} [opts.slotRules] Component tags allowed inside slots: { page: { contents: ['tabset'] } }
 * @returns {Function} Render function (h) => VNode
 */
export function serverRenderedRoot (el, { isComponent, slotRules = {} }) {
  const children = describeNodes(Array.from(el.childNodes), isComponent, slotRules)
  const attrs = plainAttrs(el)
  return h => h(el.localName, { attrs }, children.map(child => render(h, child)))
}

/**
 * Whether a tag is a globally registered Vue component
 *
 * @param {Object} Vue Vue constructor
 */
export function isRegisteredComponent (Vue) {
  const camelize = str => str.replace(/-(\w)/g, (m, c) => c.toUpperCase())
  return tag => {
    const name = camelize(tag)
    const components = Vue.options.components
    return Boolean(components[tag] || components[name] || components[name.charAt(0).toUpperCase() + name.slice(1)])
  }
}
