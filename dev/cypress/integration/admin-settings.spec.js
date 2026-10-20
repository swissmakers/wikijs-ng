/*
 * Admin form regressions against the disposable, seeded screenshot instance.
 * Run with the admin JWT returned by dev/screenshots/seed-demo.js.
 * These tests restore the settings and demo user after editing them.
 */

describe('Editable admin settings', () => {
  const jwt = Cypress.env('jwt')
  const themeQuery = `query {
    theming { config { theme iconset darkMode tocPosition injectCSS injectHead injectBody } }
  }`
  const themeMutation = `mutation (
    $theme: String!, $iconset: String!, $darkMode: Boolean!, $tocPosition: String,
    $injectCSS: String, $injectHead: String, $injectBody: String
  ) {
    theming {
      setConfig(
        theme: $theme, iconset: $iconset, darkMode: $darkMode, tocPosition: $tocPosition,
        injectCSS: $injectCSS, injectHead: $injectHead, injectBody: $injectBody
      ) { responseResult { succeeded message } }
    }
  }`
  let originalTheme
  let originalUser

  const graphql = (query, variables = {}) => cy.request({
    method: 'POST',
    url: '/graphql',
    headers: { Authorization: `Bearer ${jwt}` },
    body: { query, variables },
    log: false
  }).then(({ body }) => {
    if (body.errors) {
      throw new Error(`GraphQL request failed: ${body.errors.map(error => error.message).join('; ')}`)
    }
    return body.data
  })

  // Vuetify forwards custom attributes to its native input, while the selected
  // option's visible label belongs to the surrounding input component.
  const select = name => cy.get(`[data-test="theme-${name}"]`, { timeout: 20000 }).closest('.v-input')
  const field = name => cy.get(`[data-test="theme-inject-${name}"]`).closest('.v-input').find('textarea')
  const saveTheme = () => {
    cy.get('[data-test="theme-save"]').click()
    cy.wait('@saveTheme').then(({ response }) => {
      const results = [].concat(response.body)
      const errors = results.flatMap(item => item.errors || [])
      expect(errors.map(error => error.message), 'theme save errors').to.deep.equal([])
      const result = results.find(item => item.data && item.data.theming)
      const status = result.data.theming.setConfig.responseResult
      expect(status.succeeded, status.message).to.equal(true)
    })
    cy.get('[data-test="theme-save"]').should('not.have.class', 'v-btn--loading')
  }

  before(() => {
    expect(jwt, 'admin JWT from the demo seed').to.be.a('string').and.not.equal('')
    graphql(themeQuery).then(data => { originalTheme = data.theming.config })
    graphql('query { users { list { id name email } } }').then(data => {
      originalUser = data.users.list.find(user => user.email === 'anna.keller@example.com')
      expect(originalUser, 'seeded demo user').not.to.equal(undefined)
    })
  })

  beforeEach(() => {
    cy.setCookie('jwt', jwt)
    cy.intercept('POST', '/graphql', req => {
      if ([].concat(req.body).some(operation => operation.query.includes('setConfig('))) {
        req.alias = 'saveTheme'
      }
    })
  })

  after(() => {
    if (originalTheme) {
      graphql(themeMutation, originalTheme).then(data => {
        expect(data.theming.setConfig.responseResult.succeeded).to.equal(true)
      })
    }
    if (originalUser) {
      graphql(`mutation ($id: Int!, $name: String!) {
        users { update(id: $id, name: $name) { responseResult { succeeded message } } }
      }`, { id: originalUser.id, name: originalUser.name }).then(data => {
        expect(data.users.update.responseResult.succeeded).to.equal(true)
      })
    }
  })

  it('saves icon and layout choices, then removes custom CSS and HTML after reload', () => {
    cy.visit('/a/theme')
    select('iconset').should('contain.text', 'Material Design Icons')
    select('iconset').find('.v-select__selections').click()
    cy.contains('.v-menu__content .v-list-item', 'Font Awesome 5').click()
    select('toc-position').find('.v-select__selections').click()
    cy.contains('.v-menu__content .v-list-item', 'Right').click()
    field('css').clear()
    field('css').type('body { --admin-save-regression: 1; }', { parseSpecialCharSequences: false })
    field('head').clear()
    field('head').type('<meta name="admin-save-regression" content="1">', { parseSpecialCharSequences: false })
    field('body').clear()
    field('body').type('<!-- admin-save-regression -->', { parseSpecialCharSequences: false })
    saveTheme()

    cy.reload()
    select('iconset').should('contain.text', 'Font Awesome 5')
    select('toc-position').should('contain.text', 'Right')
    field('css').invoke('val').should('include', '--admin-save-regression')
    field('head').invoke('val').should('include', 'admin-save-regression')
    field('body').invoke('val').should('include', 'admin-save-regression')
    graphql(themeQuery).then(data => {
      expect(data.theming.config).to.include({ iconset: 'fa', tocPosition: 'right', darkMode: originalTheme.darkMode })
    })

    field('css').clear()
    field('head').clear()
    field('body').clear()
    saveTheme()
    // Exercise route navigation as well as a full reload, including Apollo's cache.
    cy.contains('.wiki-sidebar .v-list-item', 'General').click()
    cy.contains('.wiki-sidebar .v-list-item', 'Theme').click()
    select('iconset').should('contain.text', 'Font Awesome 5')
    field('css').should('have.value', '')
    cy.reload()
    select('iconset').should('contain.text', 'Font Awesome 5')
    field('css').should('have.value', '')
    field('head').should('have.value', '')
    field('body').should('have.value', '')
    graphql(themeQuery).then(data => {
      expect(data.theming.config).to.include({ injectCSS: '', injectHead: '', injectBody: '' })
    })
  })

  it('edits a user without mutating an immutable query result', () => {
    const editedName = `${originalUser.name} (edited)`
    cy.visit(`/a/users/${originalUser.id}`)
    cy.contains('.v-list-item', 'Display Name', { timeout: 20000 }).as('nameRow')
    cy.get('@nameRow').should('contain.text', originalUser.name).find('button').click()
    cy.get('.v-menu__content:visible input').clear()
    cy.get('.v-menu__content:visible input').type(`${editedName}{enter}`)
    cy.contains('.admin-header button', 'Update User').click()
    cy.location('pathname').should('equal', '/a/users')
    cy.contains('tr', editedName).should('contain.text', originalUser.email)
    cy.visit(`/a/users/${originalUser.id}`)
    cy.contains('.v-list-item', 'Display Name', { timeout: 20000 }).should('contain.text', editedName)
    cy.reload()
    cy.contains('.v-list-item', 'Display Name', { timeout: 20000 }).should('contain.text', editedName)
  })
})
