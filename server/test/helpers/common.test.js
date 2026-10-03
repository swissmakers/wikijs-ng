const commonHelper = require('../../helpers/common')

describe('helpers/common/renderCodeTemplate', () => {
  it('replaces every occurrence in every string field', () => {
    const result = commonHelper.renderCodeTemplate({
      head: '<script src="https://x/{{id}}.js"></script><script>init("{{id}}")</script>',
      bodyStart: '{{id}}-{{id}}',
      bodyEnd: ''
    }, { id: 'UA-1' })
    expect(result).toEqual({
      head: '<script src="https://x/UA-1.js"></script><script>init("UA-1")</script>',
      bodyStart: 'UA-1-UA-1',
      bodyEnd: ''
    })
  })

  it('keeps non-string fields and unknown placeholders', () => {
    const result = commonHelper.renderCodeTemplate({ codeTemplate: true, main: '{{pageId}} {{other}}' }, { pageId: 42 })
    expect(result).toEqual({ codeTemplate: true, main: '42 {{other}}' })
  })

  it('inserts values literally (no regex replacement patterns)', () => {
    const result = commonHelper.renderCodeTemplate({ head: 'a={{v}}' }, { v: '$& $1 $$' })
    expect(result.head).toBe('a=$& $1 $$')
  })
})
