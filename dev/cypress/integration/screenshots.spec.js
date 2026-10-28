/* eslint-disable cypress/no-unnecessary-waiting -- fixed waits let fonts/animations settle before capturing */
/*
 * README screenshot generator and visual regressions.
 *
 * Runs against a throwaway instance seeded by dev/screenshots/seed-demo.js.
 * Use dev/screenshots.sh to build the demo data, exercise both themes and copy
 * the resulting images to docs/screenshots/.
 */

describe('README screenshots', () => {
  const jwt = Cypress.env('jwt')
  const shot = name => cy.screenshot(name, { capture: 'viewport', overwrite: true })

  const visit = (path, readySelector, theme) => {
    cy.visit(path)
    cy.get(readySelector, { timeout: 20000 }).should('be.visible')
    if (theme === 'light') {
      cy.window().then(win => { win.WIKI.$vuetify.theme.dark = false })
    }
    // Dark mode must work by default, without a test-side override.
    cy.get('.v-application').should('have.class', 'theme--' + theme)
    cy.get('.v-application').should(app => {
      const style = app[0].ownerDocument.defaultView.getComputedStyle(app[0])
      expect(style.getPropertyValue('--wiki-background').trim(), 'theme palette loaded').to.equal(theme === 'dark' ? '#1f2023' : '#f4f5f6')
    })
  }

  const noHorizontalOverflow = () => {
    cy.document().then(doc => {
      const width = doc.documentElement.clientWidth
      const overflowing = Array.from(doc.querySelectorAll('body *')).filter(el => {
        return el.getBoundingClientRect().right > width + 1 && el.getBoundingClientRect().width > 0
      }).slice(0, 12).map(el => `${el.tagName}.${el.className}: ${Math.round(el.getBoundingClientRect().right)}`)
      expect(doc.documentElement.scrollWidth, 'page width; elements beyond viewport: ' + overflowing.join(', ')).to.be.at.most(width)
    })
  }

  const parseColor = color => color.match(/[\d.]+/g).map(Number)
  const backgroundColor = element => {
    const color = parseColor(element.ownerDocument.defaultView.getComputedStyle(element).backgroundColor)
    const alpha = color.length > 3 ? color[3] : 1
    if (alpha === 1) return color.slice(0, 3)
    const behind = element.parentElement ? backgroundColor(element.parentElement) : [255, 255, 255]
    return color.slice(0, 3).map((channel, index) => channel * alpha + behind[index] * (1 - alpha))
  }
  const luminance = color => color.map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  const readableText = selector => cy.get(selector).should(elements => {
    for (const element of elements) {
      const style = element.ownerDocument.defaultView.getComputedStyle(element)
      const color = parseColor(style.color)
      const alpha = color.length > 3 ? color[3] : 1
      const surface = backgroundColor(element)
      const foreground = luminance(color.slice(0, 3).map((channel, index) => channel * alpha + surface[index] * (1 - alpha)))
      const background = luminance(surface)
      const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      expect(contrast, 'text contrast for ' + element.textContent.trim()).to.be.at.least(4.5)
    }
  })

  beforeEach(() => {
    // Viewport size comes from the runner config; Cypress resets it each test.
    if (jwt) {
      cy.setCookie('jwt', jwt)
    }
  })

  for (const theme of ['dark', 'light']) {
    const capture = name => shot(theme === 'dark' ? name : name + '-light')

    it('page view (' + theme + ')', () => {
      visit('/docs/installation/docker', '.contents', theme)
      cy.get('.wiki-sidebar').invoke('css', 'background-color').then(sidebarBackground => {
        cy.get('.wiki-breadcrumbs').should('have.css', 'background-color', sidebarBackground)
        cy.get('.v-footer').should('have.css', 'background-color', sidebarBackground)
      })
      readableText('.contents > div > p:first-child')
      noHorizontalOverflow()
      cy.wait(1000)
      capture('page-view')
    })

    it('article formatting (' + theme + ')', () => {
      visit('/docs/installation/docker', '.contents', theme)
      cy.get('.contents table').first().scrollIntoView({ offset: { top: -100, left: 0 } })
      cy.get('.contents blockquote.is-warning').should('exist')
      cy.get('.contents blockquote.is-danger').should('exist')
      readableText('.contents table th, .contents table td')
      noHorizontalOverflow()
      cy.wait(500)
      capture('article-formatting')
    })

    it('folder view (' + theme + ')', () => {
      visit('/docs', '.folder-view-card', theme)
      readableText('.folder-view-card .subtitle-2')
      noHorizontalOverflow()
      cy.wait(750)
      capture('folder-view')
    })

    it('search overlay (' + theme + ')', () => {
      visit('/docs/installation/docker', '.contents', theme)
      cy.get('header input[type=text]').first().type('installation')
      cy.get('.search-results-items', { timeout: 15000 }).should('be.visible')
      cy.contains('.search-results-filters span', 'Only under /docs/installation/docker')
        .should('have.text', 'Only under /docs/installation/docker')
      readableText('.search-results-filters .v-chip span')
      readableText('.search-results-items .v-list-item__title')
      cy.wait(750)
      capture('search')
    })

    it('recent changes (' + theme + ')', () => {
      visit('/r', '.recent-changes-container', theme)
      readableText('.recent-changes-container .headline')
      cy.wait(1000)
      capture('recent-changes')
    })

    it('comments (' + theme + ')', () => {
      visit('/home', '.contents', theme)
      cy.get('#discussion', { timeout: 20000 }).scrollIntoView()
      cy.contains('#discussion', 'NAS backup', { timeout: 15000 })
      cy.get('.comments-post').first().scrollIntoView({ offset: { top: -160, left: 0 } })
      cy.wait(1000)
      capture('comments')
    })

    it('access inspector (' + theme + ')', () => {
      visit('/a/pages/4', '.admin-header', theme)
      cy.contains('.v-toolbar', 'Access Inspector', { timeout: 20000 }).scrollIntoView({ offset: { top: -80, left: 0 } })
      cy.contains('.v-card', 'Access Inspector').find('.v-select').click()
      cy.contains('.v-menu__content .v-list-item', 'Editors').click()
      cy.contains('.v-card', 'Access Inspector').find('table', { timeout: 15000 }).should('be.visible')
      cy.wait(750)
      cy.contains('.v-toolbar', 'Access Inspector').scrollIntoView({ offset: { top: -80, left: 0 } })
      cy.wait(500)
      capture('access-inspector')
    })

    it('admin assets (' + theme + ')', () => {
      visit('/a/assets', '.admin-assets-tree', theme)
      cy.get('.admin-assets-tree').closest('.v-card').invoke('css', 'background-color').then(cardBackground => {
        cy.get('.v-data-table').should('have.css', 'background-color', cardBackground)
      })
      cy.wait(1000)
      capture('admin-assets')
    })

    it('bookmarks (' + theme + ')', () => {
      visit('/p/bookmarks', '.profile-header', theme)
      // Profiles use the application canvas; articles have their own reading surface.
      cy.get('.v-application').invoke('css', 'background-color').then(applicationBackground => {
        cy.get('.v-main').should('have.css', 'background-color', applicationBackground)
      })
      cy.get('.wiki-sidebar').invoke('css', 'background-color').then(sidebarBackground => {
        cy.get('.v-footer').should('have.css', 'background-color', sidebarBackground)
      })
      cy.get('.profile-bookmarks-card .v-list-item').should('have.length', 5)
      readableText('.profile-bookmarks-card .v-list-item__title')
      readableText('.profile-bookmarks-card .v-list-item__subtitle')
      cy.wait(1000)
      capture('bookmarks')
    })

    it('fits articles, folders and admin on a phone (' + theme + ')', () => {
      cy.viewport(390, 844)
      for (const [path, readySelector] of [
        ['/docs/installation/docker', '.contents'],
        ['/docs', '.folder-view-card']
      ]) {
        visit(path, readySelector, theme)
        cy.get('.wiki-sidebar').should('have.class', 'v-navigation-drawer--close')
        cy.get('.v-main').should('have.css', 'padding-left', '0px')
        noHorizontalOverflow()
        cy.get('.v-btn--fab .mdi-menu').closest('button').click()
        cy.get('.wiki-sidebar').should('have.class', 'v-navigation-drawer--open').and('contain.text', 'All documentation')
        noHorizontalOverflow()
      }

      visit('/a/theme', '[data-test="theme-iconset"]', theme)
      cy.get('#admin-navigation').should('have.class', 'v-navigation-drawer--close')
      cy.get('.v-main').should('have.css', 'padding-left', '0px')
      noHorizontalOverflow()
      cy.get('header button[aria-controls="admin-navigation"]').should('have.attr', 'aria-expanded', 'false').click()
      cy.get('#admin-navigation').should('have.class', 'v-navigation-drawer--open').and('contain.text', 'General')
      cy.get('header button[aria-controls="admin-navigation"]').should('have.attr', 'aria-expanded', 'true')
      noHorizontalOverflow()
    })
  }

  it('highlights code without requesting missing Prism grammars', () => {
    // -> Fence names Prism has no file for (apache, plaincommand) must not trigger 404s
    const prismRequests = []
    cy.intercept('GET', '/_assets/js/prism/**', req => {
      req.continue(res => { prismRequests.push(`${res.statusCode} ${req.url}`) })
    })
    for (const path of ['/docs/installation/linux', '/docs/installation/docker']) {
      cy.visit(path)
      cy.get('.contents', { timeout: 20000 }).should('be.visible')
    }
    cy.visit('/docs/installation/linux')
    cy.get('.contents code.language-apacheconf .token', { timeout: 15000 }).should('exist')
    cy.wrap(prismRequests).should(requests => {
      expect(requests.filter(r => !r.startsWith('200')), 'failed Prism requests').to.deep.equal([])
    })
  })

  it('login', () => {
    cy.clearCookie('jwt')
    cy.visit('/login')
    cy.get('.login-sd', { timeout: 20000 }).should('be.visible')
    cy.get('.login-intro h1').should('have.text', "Your team's knowledgebase")
    cy.get('.login-head-title').should('have.text', 'Swissmakers Wiki')
    cy.get('.login').should('have.css', 'background-image').and('include', 'login-office.jpg')
    cy.wait(1000)
    shot('login')
  })

  it('signs in on a phone without horizontal overflow', () => {
    cy.clearCookie('jwt')
    cy.viewport(390, 844)
    cy.visit('/login')
    cy.get('.login-sd', { timeout: 20000 }).should('be.visible')
    noHorizontalOverflow()
    cy.get('.login-form input[type=email]').type('anna.keller@example.com')
    cy.get('.login-form input[type=password]').type('Demo-Passw0rd!', { log: false })
    cy.contains('.login-form button', 'Log In').click()
    cy.get('.contents', { timeout: 20000 }).should('be.visible')
    cy.visit('/p/bookmarks')
    cy.get('.profile-header', { timeout: 20000 }).should('be.visible')
    noHorizontalOverflow()
    cy.get('header button[aria-label="Profile"]').click()
    cy.get('.wiki-sidebar').should('be.visible').and('contain.text', 'Watched Pages')
  })
})
