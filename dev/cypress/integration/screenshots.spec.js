/* eslint-disable cypress/no-unnecessary-waiting -- fixed waits let fonts/animations settle before capturing */
/*
 * README screenshot generator.
 *
 * Runs against a seeded local instance (not part of regular e2e tests).
 * Usage:
 *   1. Start a Wiki.js NG instance with demo content (pages under /docs/...)
 *   2. cypress run --spec dev/cypress/integration/screenshots.spec.js \
 *        --config baseUrl=http://127.0.0.1:3999,video=false --env jwt=<admin-jwt>
 *   3. Screenshots land in dev/cypress/screenshots/screenshots.spec.js/
 */

describe('README screenshots', () => {
  const jwt = Cypress.env('jwt')

  beforeEach(() => {
    // viewport size comes from viewportWidth/viewportHeight config
    if (jwt) {
      cy.setCookie('jwt', jwt)
    }
  })

  it('page view', () => {
    cy.visit('/home')
    cy.get('.contents', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    cy.screenshot('page-view', { capture: 'viewport', overwrite: true })
  })

  it('folder view', () => {
    cy.visit('/docs/installation')
    cy.get('.folder-view-card', { timeout: 20000 }).should('be.visible')
    cy.wait(1000)
    cy.screenshot('folder-view', { capture: 'viewport', overwrite: true })
  })

  it('search overlay', () => {
    cy.visit('/home')
    cy.get('.contents', { timeout: 20000 }).should('be.visible')
    cy.get('header input[type=text]').first().type('installation')
    cy.get('.search-results-items', { timeout: 15000 }).should('be.visible')
    cy.wait(750)
    cy.screenshot('search', { capture: 'viewport', overwrite: true })
  })

  it('admin assets', () => {
    cy.visit('/a/assets')
    cy.get('.admin-assets-tree', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    cy.screenshot('admin-assets', { capture: 'viewport', overwrite: true })
  })

  it('profile', () => {
    cy.visit('/p/profile')
    cy.get('.profile-header', { timeout: 20000 }).should('be.visible')
    cy.wait(1500)
    cy.screenshot('profile', { capture: 'viewport', overwrite: true })
  })

  it('login', () => {
    cy.clearCookie('jwt')
    cy.visit('/login')
    cy.get('.login-sd', { timeout: 20000 }).should('be.visible')
    cy.wait(1000)
    cy.screenshot('login', { capture: 'viewport', overwrite: true })
  })
})
