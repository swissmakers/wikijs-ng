#!/usr/bin/env node
/*
 * Seed a FRESH Wiki.js NG instance with the demo content used for the README
 * screenshots: setup wizard, users and a group with page rules, a small
 * documentation tree, assets, a moderated comment thread, bookmarks and watches.
 *
 * Never run this against a real wiki — it completes the setup wizard and
 * creates users and content. dev/screenshots.sh runs it against a throwaway
 * container.
 *
 * Usage: node dev/screenshots/seed-demo.js <base url> <admin email> <admin password>
 * Prints the admin JWT on the last line of stdout.
 */
const fs = require('fs')
const path = require('path')

const [BASE, ADMIN_EMAIL, ADMIN_PASS] = process.argv.slice(2)
if (!BASE || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Usage: seed-demo.js <base url> <admin email> <admin password>')
  process.exit(1)
}
const USER_PASS = 'Demo-Passw0rd!'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const log = msg => console.error(`>> ${msg}`)

async function waitFor (url, pattern) {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(url)
      if (res.ok && (await res.text()).includes(pattern)) {
        return
      }
    } catch (err) {}
    await sleep(1000)
  }
  throw new Error(`${url} did not come up`)
}

async function gql (jwt, query, variables = {}) {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(jwt && { Authorization: `Bearer ${jwt}` }) },
    body: JSON.stringify({ query, variables })
  })
  const body = await res.json()
  if (body.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(body.errors)}`)
  }
  // -> Mutations report failures in responseResult instead of errors
  const result = JSON.stringify(body.data).match(/"succeeded":false[^}]*"message":"([^"]*)"/)
  if (result) {
    throw new Error(`GraphQL mutation failed: ${result[1]}`)
  }
  return body.data
}

async function login (email, password) {
  const data = await gql(null, `mutation ($u: String!, $p: String!) {
    authentication { login(username: $u, password: $p, strategy: "local") { jwt responseResult { succeeded message } } }
  }`, { u: email, p: password })
  return data.authentication.login.jwt
}

// -----------------------------------------------
// Demo content
// -----------------------------------------------

const pages = [
  {
    path: 'home',
    title: 'Welcome',
    description: 'The home page of your knowledge base',
    tags: ['welcome'],
    content: `# Welcome to Wiki.js NG

Your team's knowledge base — fast, structured and easy to maintain.

## Getting Started

Browse the sidebar or use the search bar above to find what you need. Content is organized in a folder tree, and every page can be tagged for cross-cutting discovery.

## Documentation Structure

| Section | Description |
| --- | --- |
| Installation | Deploy Wiki.js NG with [Docker](/docs/installation/docker) or on [Linux](/docs/installation/linux) |
| Administration | [Backups](/docs/administration/backups), [upgrades](/docs/administration/upgrades) and [Git sync](/docs/administration/git-sync) |
| Development | [Building from source](/docs/development/building) and [contributing](/docs/development/contributing) |

New here? Start with the [FAQ](/docs/faq) and the [glossary](/docs/glossary).

## Why Wiki.js NG?

- **Markdown-first** editing with live preview
- **Full-text search** that actually searches page content
- Fine-grained **permissions** per group and path
- Bi-directional **Git synchronization** for your content
- **Watch** pages and folders and get an e-mail digest of changes

> Press \`?\` anywhere to see the keyboard shortcuts.
{.is-info}

## Need Help?

Ask in the comments below or contact the platform team.
`
  },
  {
    path: 'docs/installation/docker',
    title: 'Docker Installation',
    description: 'Run Wiki.js NG as a container',
    tags: ['installation', 'containers'],
    content: `# Docker Installation

Wiki.js NG ships as a multi-arch container image (\`linux/amd64\`, \`linux/arm64\`).

## Quick start

\`\`\`bash
podman run -d --name wikijs-ng -p 3000:3000 \\
  -e DB_TYPE=postgres -e DB_HOST=db.example.com \\
  -e DB_USER=wikijs -e DB_PASS=changeme -e DB_NAME=wiki \\
  ghcr.io/swissmakers/wikijs-ng:latest
\`\`\`

Open \`http://localhost:3000\` and complete the setup wizard.

## Persistent data

Mount \`/wiki/data\` to keep uploads, the Git repository and sideloaded locales across restarts.

## Next steps

- Configure [backups](/docs/administration/backups)
- Read the [upgrade notes](/docs/administration/upgrades)
`
  },
  {
    path: 'docs/installation/linux',
    title: 'Linux Installation',
    description: 'Install Wiki.js NG on a Linux server',
    tags: ['installation'],
    content: `# Linux Installation

## Requirements

- Node.js 24 or later
- PostgreSQL, MySQL, MariaDB, SQLite or MS SQL Server

## Steps

1. Download and extract the release
2. Copy \`config.sample.yml\` to \`config.yml\` and set the database connection
3. Start the server with \`node server\`
4. Create a systemd unit to keep it running

See [Docker Installation](/docs/installation/docker) for the container variant.
`
  },
  {
    path: 'docs/administration/backups',
    title: 'Backups',
    description: 'Back up the database and the data folder',
    tags: ['operations'],
    content: `# Backups

Wiki.js NG keeps all content in the database. Back up:

- the **database** (e.g. \`pg_dump\` or \`mariadb-dump\`) — nightly
- the **data folder** (\`/wiki/data\`) — contains the Git repository and uploads cache

## Restore test

Restore the latest dump into a staging instance once per quarter.
`
  },
  {
    path: 'docs/administration/upgrades',
    title: 'Upgrades',
    description: 'Upgrade to a new Wiki.js NG release',
    tags: ['operations'],
    content: `# Upgrades

1. Read the CHANGELOG of the new release
2. Take a [backup](/docs/administration/backups)
3. Pull the new image and restart the container — database migrations run automatically
`
  },
  {
    path: 'docs/administration/git-sync',
    title: 'Git Synchronization',
    description: 'Keep pages in sync with a Git repository',
    tags: ['operations', 'git'],
    content: `# Git Synchronization

Admin → Storage → Git keeps every page and asset in a Git repository.

- **Sync** mode pulls remote changes and pushes wiki edits every 5 minutes
- Conflicting edits are resolved in favour of the wiki
- Leftover changes from interrupted operations are committed automatically on the next run
`
  },
  {
    path: 'docs/development/building',
    title: 'Building from Source',
    description: 'Build the client assets and the container image',
    tags: ['development'],
    content: `# Building from Source

\`\`\`bash
yarn install
yarn build
yarn test
node server
\`\`\`

Use \`yarn build:safe\` on memory-constrained hosts.
`
  },
  {
    path: 'docs/faq',
    title: 'FAQ',
    description: 'Frequently asked questions',
    tags: ['help'],
    content: `# FAQ

## Who can edit pages?

Members of the *Editors* group can edit everything except the administration section.

## How do I get notified about changes?

Use the bell next to the share button to watch a page or a whole folder.
`
  },
  {
    path: 'docs/glossary',
    title: 'Glossary',
    description: 'Terms used throughout the documentation',
    tags: ['help'],
    content: `# Glossary

- **Page rule** — grants or denies permissions for a path prefix
- **Storage target** — a backend that receives a copy of every page (Git, disk, S3, …)
- **Watch** — an e-mail digest subscription for a page or folder
`
  },
  {
    path: 'docs/development/contributing',
    title: 'Contributing',
    description: 'How to propose changes',
    tags: ['development'],
    content: `# Contributing

1. Open an issue describing the change
2. Create a branch and keep commits focused
3. Run \`yarn test\` before opening a pull request
`
  }
]

async function main () {
  log(`Seeding ${BASE}...`)
  await waitFor(`${BASE}/`, 'Wiki.js NG')

  // -> Setup wizard
  const setup = await fetch(`${BASE}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASS, adminPasswordConfirm: ADMIN_PASS, siteUrl: BASE })
  }).then(res => res.json())
  if (!setup.ok) {
    throw new Error(`Setup failed: ${JSON.stringify(setup)}`)
  }
  await sleep(3000)
  await waitFor(`${BASE}/healthz`, 'ok')
  const admin = await login(ADMIN_EMAIL, ADMIN_PASS)
  log('Setup completed')

  // -> Editors may edit everything except the administration section, readers may comment
  const group = async (name, permissions, rules) => {
    const id = (await gql(admin, 'mutation ($n: String!) { groups { create(name: $n) { responseResult { succeeded message } group { id } } } }', { n: name })).groups.create.group.id
    await gql(admin, `mutation ($id: Int!, $n: String!, $perms: [String]!, $rules: [PageRuleInput]!) {
      groups { update(id: $id, name: $n, redirectOnLogin: "/", permissions: $perms, pageRules: $rules) { responseResult { succeeded message } } }
    }`, { id, n: name, perms: permissions, rules })
    return id
  }
  const readPerms = ['read:pages', 'read:assets', 'read:comments', 'write:comments']
  const editPerms = [...readPerms, 'read:source', 'read:history', 'write:pages', 'write:assets']
  const editors = await group('Editors', editPerms, [
    { id: 'editors-all', deny: false, match: 'START', roles: editPerms, path: '', locales: [] },
    { id: 'editors-admin-ro', deny: true, match: 'START', roles: ['write:pages'], path: 'docs/administration', locales: [] }
  ])
  const readers = await group('Readers', readPerms, [
    { id: 'readers-all', deny: false, match: 'START', roles: readPerms, path: '', locales: [] }
  ])
  const users = [
    { email: 'anna.keller@example.com', name: 'Anna Keller', groups: [editors] },
    { email: 'jonas.meier@example.com', name: 'Jonas Meier', groups: [readers] }
  ]
  for (const usr of users) {
    await gql(admin, `mutation ($e: String!, $n: String!, $g: [Int]!, $p: String!) {
      users { create(email: $e, name: $n, passwordRaw: $p, providerKey: "local", groups: $g, mustChangePassword: false, sendWelcomeEmail: false) { responseResult { succeeded message } } }
    }`, { e: usr.email, n: usr.name, g: usr.groups, p: USER_PASS })
  }
  const anna = await login('anna.keller@example.com', USER_PASS)
  const jonas = await login('jonas.meier@example.com', USER_PASS)
  log('Users and groups created')

  // -> Pages (most created by the admin, a few by Anna)
  // -> The home page is created last, so its links point to existing pages
  const pageIds = {}
  for (const pg of [...pages.slice(1), pages[0]]) {
    const author = ['docs/installation/linux', 'docs/development/contributing', 'docs/glossary'].includes(pg.path) ? anna : admin
    await gql(author, `mutation ($c: String!, $d: String!, $p: String!, $t: String!, $tags: [String]!) {
      pages { create(content: $c, description: $d, editor: "markdown", isPublished: true, isPrivate: false, locale: "en", path: $p, tags: $tags, title: $t) { responseResult { succeeded message } } }
    }`, { c: pg.content, d: pg.description, p: pg.path, t: pg.title, tags: pg.tags })
    pageIds[pg.path] = (await gql(admin, 'query ($p: String!) { pages { singleByPath(path: $p, locale: "en") { id } } }', { p: pg.path })).pages.singleByPath.id
  }
  // -> A few edits so the recent changes show more than creations
  //    (complete updates: before 2.8.1 a partial update unpublished the page)
  const edit = (jwt, pg, changes) => gql(jwt, `mutation ($id: Int!, $c: String!, $d: String!, $t: String!, $tags: [String]!) {
    pages { update(id: $id, content: $c, description: $d, title: $t, tags: $tags, isPublished: true, isPrivate: false) { responseResult { succeeded message } } }
  }`, { id: pageIds[pg.path], c: pg.content, d: pg.description, t: pg.title, tags: pg.tags, ...changes })
  await edit(anna, pages[1], { c: pages[1].content.replace('## Next steps', '## Health check\n\nThe image reports its health on `/healthz`.\n\n## Next steps') })
  await edit(admin, pages[2], { d: 'Run Wiki.js NG behind a reverse proxy or standalone' })
  log(`${pages.length} pages created`)

  // -> Assets
  const folderMutation = 'mutation ($slug: String!) { assets { createFolder(parentFolderId: 0, slug: $slug) { responseResult { succeeded message } } } }'
  await gql(admin, folderMutation, { slug: 'diagrams' })
  await gql(admin, folderMutation, { slug: 'screenshots' })
  const folders = (await gql(admin, '{ assets { folders(parentFolderId: 0) { id slug } } }')).assets.folders
  const logo = fs.readFileSync(path.join(__dirname, '../../client/static/svg/logo-swissmakers.svg'))
  const uploads = [
    { name: 'architecture-diagram.svg', folder: 0, data: logo, type: 'image/svg+xml' },
    { name: 'network-overview.svg', folder: folders.find(f => f.slug === 'diagrams').id, data: logo, type: 'image/svg+xml' },
    { name: 'deployment-flow.svg', folder: folders.find(f => f.slug === 'diagrams').id, data: logo, type: 'image/svg+xml' },
    { name: 'release-notes.txt', folder: 0, data: Buffer.from('Wiki.js NG release notes\n'), type: 'text/plain' }
  ]
  for (const up of uploads) {
    const form = new FormData()
    form.append('mediaUpload', JSON.stringify({ folderId: up.folder }))
    form.append('mediaUpload', new Blob([up.data], { type: up.type }), up.name)
    const res = await fetch(`${BASE}/u`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: form })
    if (!res.ok) {
      throw new Error(`Upload of ${up.name} failed: ${res.status} ${await res.text()}`)
    }
  }
  log('Assets uploaded')

  // -> Mail pointing at a closed local port: enables the watch UI, never delivers anything
  await gql(admin, `mutation { mail { updateConfig(senderName: "Wiki.js NG", senderEmail: "wiki@example.com", host: "127.0.0.1", port: 2525, name: "",
    secure: false, verifySSL: false, user: "", pass: "", useDKIM: false, dkimDomainName: "", dkimKeySelector: "", dkimPrivateKey: "") { responseResult { succeeded message } } } }`)

  // -> Comments: moderation for everyone, so a pending reply shows up
  await gql(admin, 'mutation ($cfg: [KeyValuePairInput]) { comments { updateProviders(providers: [{ isEnabled: true, key: "default", config: $cfg }]) { responseResult { succeeded message } } } }', {
    cfg: [
      { key: 'akismet', value: JSON.stringify({ v: '' }) },
      { key: 'minDelay', value: JSON.stringify({ v: 0 }) },
      { key: 'moderation', value: JSON.stringify({ v: 'all' }) }
    ]
  })
  const comment = async (jwt, content, replyTo) => {
    const data = await gql(jwt, 'mutation ($p: Int!, $c: String!, $r: Int) { comments { create(pageId: $p, content: $c, replyTo: $r) { responseResult { succeeded message } id isPending } } }', {
      p: pageIds.home, c: content, r: replyTo
    })
    // -> comments.create is rate limited to one call per 15 seconds
    await sleep(16000)
    return data.comments.create
  }
  const question = await comment(jonas, 'Is there a recommended way to back up the Git repository as well, or is the database dump enough?')
  await gql(admin, 'mutation ($id: Int!) { comments { approve(id: $id) { responseResult { succeeded message } } } }', { id: question.id })
  await comment(admin, 'The database dump is enough — the repository can always be rebuilt from it. See the Backups page for the schedule.', question.id)
  await comment(anna, 'We also keep the data folder in the nightly NAS backup, so a restore is faster.', question.id)
  log('Comments created')

  // -> Bookmarks and watches of the admin
  for (const p of ['home', 'docs/installation/docker', 'docs/administration/backups']) {
    await gql(admin, 'mutation ($id: Int!) { bookmarks { toggle(pageId: $id) { responseResult { succeeded message } } } }', { id: pageIds[p] })
  }
  await gql(admin, 'mutation ($id: Int!) { watches { watchPage(pageId: $id) { responseResult { succeeded message } } } }', { id: pageIds['docs/installation/docker'] })
  await gql(admin, 'mutation { watches { watchPath(locale: "en", path: "docs/administration") { responseResult { succeeded message } } } }')
  log('Bookmarks and watches created')

  console.log(admin)
}

main().catch(err => {
  console.error(`!! ${err.message}`)
  process.exit(1)
})
