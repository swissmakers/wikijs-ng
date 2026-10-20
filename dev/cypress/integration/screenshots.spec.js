/* eslint-disable cypress/no-unnecessary-waiting -- fixed waits let fonts/animations settle before capturing */
/*
 * README screenshot generator.
 *
 * Runs against a throwaway instance seeded by dev/screenshots/seed-demo.js
 * (not part of regular e2e tests). Use dev/screenshots.sh, which starts the
 * instance, seeds it, runs this spec and copies the results to docs/screenshots/.
 */

describe('README screenshots', () => {
  const jwt = Cypress.env('jwt')
  const shot = name => cy.screenshot(name, { capture: 'viewport', overwrite: true })

  beforeEach(() => {
    // viewport size comes from viewportWidth/viewportHeight config
    if (jwt) {
      cy.setCookie('jwt', jwt)
    }
  })

  it('page view', () => {
    cy.visit('/docs/installation/docker')
    cy.get('.contents', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    shot('page-view')
  })

  it('folder view', () => {
    cy.visit('/docs')
    cy.get('.folder-view-card', { timeout: 20000 }).should('be.visible')
    cy.wait(1000)
    shot('folder-view')
  })

  it('search overlay', () => {
    cy.visit('/home')
    cy.get('.contents', { timeout: 20000 }).should('be.visible')
    cy.get('header input[type=text]').first().type('installation')
    cy.get('.search-results-items', { timeout: 15000 }).should('be.visible')
    cy.wait(750)
    shot('search')
  })

  it('recent changes', () => {
    cy.visit('/r')
    cy.get('.recent-changes-container', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    shot('recent-changes')
  })

  it('comments', () => {
    cy.visit('/home')
    cy.get('#discussion', { timeout: 20000 }).scrollIntoView()
    cy.contains('#discussion', 'NAS backup', { timeout: 15000 })
    cy.get('.comments-post').first().scrollIntoView({ offset: { top: -160, left: 0 } })
    cy.wait(1500)
    shot('comments')
  })

  it('access inspector', () => {
    cy.visit('/a/pages/4')
    cy.contains('.v-toolbar', 'Access Inspector', { timeout: 20000 }).scrollIntoView({ offset: { top: -80, left: 0 } })
    cy.contains('.v-card', 'Access Inspector').find('.v-select').click()
    cy.contains('.v-menu__content .v-list-item', 'Editors').click()
    cy.contains('.v-card', 'Access Inspector').find('table', { timeout: 15000 }).should('be.visible')
    cy.wait(1000)
    cy.contains('.v-toolbar', 'Access Inspector').scrollIntoView({ offset: { top: -80, left: 0 } })
    cy.wait(500)
    shot('access-inspector')
  })

  it('admin assets', () => {
    cy.visit('/a/assets')
    cy.get('.admin-assets-tree', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    shot('admin-assets')
  })

  it('bookmarks', () => {
    cy.visit('/p/bookmarks')
    cy.get('.profile-header', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    shot('bookmarks')
  })

  it('login', () => {
    cy.clearCookie('jwt')
    cy.visit('/login')
    cy.get('.login-sd', { timeout: 20000 }).should('be.visible')
    cy.wait(1000)
    shot('login')
  })
})
