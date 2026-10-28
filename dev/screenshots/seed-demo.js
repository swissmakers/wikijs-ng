#!/usr/bin/env node
/*
 * Seed a FRESH Wiki.js NG instance with the demo content used for the README
 * screenshots: a small fictional company workspace with people, groups and
 * page rules, a documentation tree, assets, moderated comment threads,
 * bookmarks and watches.
 *
 * Never run this against a real wiki — it completes the setup wizard and
 * creates users and content. dev/screenshots.sh runs it against a throwaway
 * container.
 *
 * Usage: node dev/screenshots/seed-demo.js <base url> <admin email> <admin password> [timeline.sql]
 * Prints the admin JWT on the last line of stdout. With a timeline file, it also
 * writes SQL that spreads the page activity and comments over the last two weeks
 * (the API always records "now"); dev/screenshots.sh applies it inside the container.
 */
const fs = require('fs')
const path = require('path')

const [BASE, ADMIN_EMAIL, ADMIN_PASS, TIMELINE_FILE] = process.argv.slice(2)
if (!BASE || !ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('Usage: seed-demo.js <base url> <admin email> <admin password> [timeline.sql]')
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
  try {
    const data = await gql(null, `mutation ($u: String!, $p: String!) {
      authentication { login(username: $u, password: $p, strategy: "local") { jwt responseResult { succeeded message } } }
    }`, { u: email, p: password })
    return data.authentication.login.jwt
  } catch (err) {
    // -> Logins are rate limited (5 per minute): wait as long as the server asks
    const wait = err.message.match(/try again in (\d+) seconds/)
    if (!wait) {
      throw err
    }
    log(`Login rate limit reached, waiting ${wait[1]}s...`)
    await sleep((Number(wait[1]) + 1) * 1000)
    return login(email, password)
  }
}

// -----------------------------------------------
// Demo content: "Swissmakers", a small IT services team
// -----------------------------------------------

const ADMIN_PROFILE = { name: 'Lea Brunner', jobTitle: 'Platform Lead', location: 'Zurich' }
// New accounts default to America/New_York; the demo team works in Switzerland
const TIMEZONE = 'Europe/Zurich'

const people = [
  { key: 'anna', email: 'anna.keller@example.com', name: 'Anna Keller', jobTitle: 'Technical Writer', location: 'Bern', group: 'Editors' },
  { key: 'marco', email: 'marco.rossi@example.com', name: 'Marco Rossi', jobTitle: 'DevOps Engineer', location: 'Lugano', group: 'Editors' },
  { key: 'sophie', email: 'sophie.dubois@example.com', name: 'Sophie Dubois', jobTitle: 'People & Culture', location: 'Geneva', group: 'Editors' },
  { key: 'jonas', email: 'jonas.meier@example.com', name: 'Jonas Meier', jobTitle: 'Support Engineer', location: 'Basel', group: 'Readers' }
]

// The first entry (home) is created last so its links render as existing pages.
// Keep the order of the next four: the screenshots open page #4 (docs/administration/upgrades),
// which an Editors page rule makes read-only.
const pages = [
  {
    path: 'home',
    author: 'admin',
    title: 'Welcome',
    description: 'Team knowledge, technical guides and working agreements',
    tags: ['welcome'],
    content: `Welcome to the Swissmakers workspace — the place where we keep how things work, why we decided them and who to ask.

## Getting started

Browse the sidebar or press \`/\` to search. Pages are organized in folders, and every page can be tagged for cross-cutting topics. Star the pages you need often, and use the bell to get an e-mail digest when a page or a whole folder changes.

## Where to find what

| Area | What you will find |
| --- | --- |
| Installation | Deploy the wiki with [Docker](/docs/installation/docker) or on [Linux](/docs/installation/linux) |
| Administration | [Backups](/docs/administration/backups), [upgrades](/docs/administration/upgrades) and [Git sync](/docs/administration/git-sync) |
| Development | [Building from source](/docs/development/building) and [contributing](/docs/development/contributing) |
| Team handbook | [New starter guide](/docs/handbook/onboarding) and [working agreements](/docs/handbook/working-agreements) |
| Operations | [Service catalog](/docs/operations/service-catalog), [on-call](/docs/operations/on-call) and [incident response](/docs/operations/incident-response) |

New here? Start with the [FAQ](/docs/faq) and the [glossary](/docs/glossary).

## What makes a good page

- A clear **title** and a one-line **description**
- An **owner** who reviews it every quarter
- **Links** to related pages instead of copied text
- **Tags** for topics that span several folders

> Press \`?\` anywhere to see all keyboard shortcuts.
{.is-info}

## Need help?

Ask in the comments below or reach the platform team in \`#workspace\`.
`
  },
  {
    path: 'docs/installation/docker',
    author: 'marco',
    title: 'Docker Installation',
    description: 'Run Wiki.js NG as a container',
    tags: ['installation', 'containers'],
    content: `Keep your team's knowledge available with a repeatable container deployment. This guide covers the recommended setup for the Swissmakers Wiki.

> **Before you begin** — provision a PostgreSQL database and a persistent data volume. The image supports both \`linux/amd64\` and \`linux/arm64\`.
{.is-info}

## Quick start

\`\`\`plaincommand
podman run -d --name wikijs-ng -p 3000:3000 \\
  -e DB_TYPE=postgres -e DB_HOST=db.example.com \\
  -e DB_USER=wikijs -e DB_PASS=changeme -e DB_NAME=wiki \\
  ghcr.io/swissmakers/wikijs-ng:latest
\`\`\`

Open \`http://localhost:3000\` and complete the setup wizard.

## Persistent data

Mount \`/wiki/data\` to keep uploads, the Git repository and sideloaded locales across restarts.

## Configuration reference

| Setting | Purpose | Example |
| --- | --- | --- |
| \`DB_TYPE\` | Database engine | \`postgres\` |
| \`DB_HOST\` | Database endpoint | \`db.internal.example.com\` |
| \`DB_NAME\` | Wiki database | \`wiki\` |
| \`/wiki/data\` | Persistent volume | \`/srv/wiki/data\` |

> **Back up before upgrading.** Keep a database snapshot and a copy of the data volume. Test the restore procedure in a separate environment.
{.is-warning}

> **Access is restricted.** Keep the database on your private network and store credentials in your secrets manager.
{.is-danger}

### Deployment checklist

1. Confirm the database and volume are available.
2. Start the container and complete the setup wizard.
3. Configure authentication and verify access with a team member.

## Next steps

- Configure [backups](/docs/administration/backups)
- Read the [upgrade notes](/docs/administration/upgrades)
`
  },
  {
    path: 'docs/installation/linux',
    author: 'anna',
    title: 'Linux Installation',
    description: 'Install Wiki.js NG on a Linux server',
    tags: ['installation'],
    content: `Run the wiki directly on a Linux server when containers are not an option.

## Requirements

- Node.js 24 or later
- PostgreSQL, MySQL, MariaDB, SQLite or MS SQL Server
- A reverse proxy for TLS (nginx, Apache or Traefik)

## Installation

1. Download and extract the release to \`/opt/wikijs-ng\`
2. Copy \`config.sample.yml\` to \`config.yml\` and set the database connection
3. Start the server once with \`node server\` and complete the setup wizard
4. Create a systemd unit so the wiki starts on boot

\`\`\`ini
[Unit]
Description=Wiki.js NG
After=network.target

[Service]
WorkingDirectory=/opt/wikijs-ng
ExecStart=/usr/bin/node server
User=wiki
Restart=always

[Install]
WantedBy=multi-user.target
\`\`\`

## Reverse proxy

Terminate TLS in front of the wiki, for example with Apache:

\`\`\`apache
<VirtualHost *:443>
  ServerName wiki.example.com
  ProxyPreserveHost On
  ProxyPass / http://127.0.0.1:3000/
  ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
\`\`\`

See [Docker Installation](/docs/installation/docker) for the container variant.
`
  },
  {
    path: 'docs/administration/backups',
    author: 'admin',
    title: 'Backups',
    description: 'Back up the database and the data folder',
    tags: ['operations', 'backup'],
    content: `The database holds every page, version, comment and setting. The data folder only holds caches, uploads in transit and the Git working copy.

## What we back up

| What | How | When | Retention |
| --- | --- | --- | --- |
| Database | \`pg_dump\` / \`mariadb-dump\` | Nightly at 02:00 | 7 days |
| Data folder | Snapshot of \`/wiki/data\` | Nightly at 02:00 | 7 days |
| Off-site copy | NAS replication | Weekly | 3 months |

## Restore test

Restore the latest dump into a staging instance once per quarter and record the result in the [service catalog](/docs/operations/service-catalog).

> A backup you have never restored is only a hope. Schedule the restore test with the on-call engineer.
{.is-warning}
`
  },
  {
    path: 'docs/administration/upgrades',
    author: 'admin',
    title: 'Upgrades',
    description: 'Upgrade to a new Wiki.js NG release',
    tags: ['operations'],
    content: `Upgrades are announced one week ahead in \`#workspace\` and run on Thursday evenings.

## Procedure

1. Read the CHANGELOG of the new release
2. Take a [backup](/docs/administration/backups) and verify it
3. Pull the new image and restart the service — database migrations run automatically
4. Check \`/healthz\`, sign in and run a search
5. Post a short summary in \`#workspace\`

## Rolling back

Keep the previous image tagged as \`rollback-<date>\`. If the new version misbehaves, start the previous image and restore the database dump taken in step 2.
`
  },
  {
    path: 'docs/administration/git-sync',
    author: 'admin',
    title: 'Git Synchronization',
    description: 'Keep pages in sync with a Git repository',
    tags: ['operations', 'git'],
    content: `Admin → Storage → Git keeps every page and asset in a Git repository, so you can review changes, edit Markdown in your editor and keep an off-site copy.

## How it works

- **Sync** mode pulls remote changes and pushes wiki edits every 5 minutes
- Conflicting edits are resolved in favour of the wiki
- Leftover changes from interrupted operations are committed automatically on the next run
- Pages edited in the wiki keep their author; only remote changes are imported

## Editing in Git

Front matter at the top of each file holds the title, description, tags and published state. Commit to \`main\`; the wiki imports the change within five minutes.
`
  },
  {
    path: 'docs/development/building',
    author: 'admin',
    title: 'Building from Source',
    description: 'Build the client assets and the container image',
    tags: ['development'],
    content: `## Local build

\`\`\`bash
yarn install
yarn build
yarn test
node server
\`\`\`

Use \`yarn build:safe\` on memory-constrained hosts — it limits memory and CPU for the webpack build.

## Container image

The image is built from \`dev/build/Dockerfile\`. CI builds multi-arch images (amd64 / arm64) from \`main\` after lint, unit tests and a smoke test pass.
`
  },
  {
    path: 'docs/faq',
    author: 'anna',
    title: 'FAQ',
    description: 'Frequently asked questions',
    tags: ['help'],
    content: `## Who can edit pages?

Members of the *Editors* group can edit everything except the administration section, which only the platform team maintains.

## How do I get notified about changes?

Use the bell next to the share button to watch a page or a whole folder. You receive one e-mail digest every ten minutes, never for your own changes.

## Can I export a page?

Yes — use *Export as PDF* below the table of contents, or press \`p\`.

## Where do I report a mistake?

Leave a comment on the page. The page owner is notified.
`
  },
  {
    path: 'docs/glossary',
    author: 'anna',
    title: 'Glossary',
    description: 'Terms used throughout the documentation',
    tags: ['help', 'reference'],
    content: `| Term | Meaning |
| --- | --- |
| Page rule | Grants or denies permissions for a path prefix, per group |
| Storage target | A backend that receives a copy of every page (Git, disk, S3, …) |
| Watch | An e-mail digest subscription for a page or folder |
| Bookmark | A starred page, listed in your profile |
| Page owner | The person who reviews a page every quarter |
`
  },
  {
    path: 'docs/development/contributing',
    author: 'anna',
    title: 'Contributing',
    description: 'How to propose changes to the platform',
    tags: ['development'],
    content: `## Workflow

1. Open an issue describing the problem or idea
2. Create a branch and keep commits focused
3. Run \`yarn test\` before opening a pull request
4. Ask a teammate for review — one approval is enough

## Style

We follow the \`standard\` JavaScript style. Comments explain *why*, not *what*.
`
  },
  {
    path: 'docs/handbook/onboarding',
    author: 'sophie',
    title: 'New Starter Guide',
    description: 'Your first week: accounts, people and useful resources',
    tags: ['people', 'onboarding'],
    content: `## Welcome to the team

Use this checklist with your onboarding buddy during your first week.

- [ ] Activate your account and set up two-factor authentication
- [ ] Read the [working agreements](/docs/handbook/working-agreements)
- [ ] Explore the [service catalog](/docs/operations/service-catalog)
- [ ] Join \`#workspace\` and \`#incidents\`
- [ ] Bookmark the pages you use most

## Your first month

| Week | Focus |
| --- | --- |
| 1 | Accounts, tools and meeting the team |
| 2 | Shadow the on-call engineer for a day |
| 3–4 | Take over your first small project |

> Questions are welcome. Leave a comment on the relevant page so the next person can benefit too.
{.is-success}
`
  },
  {
    path: 'docs/handbook/working-agreements',
    author: 'sophie',
    title: 'Working Agreements',
    description: 'How we document decisions and collaborate across teams',
    tags: ['people', 'collaboration'],
    content: `## Make knowledge easy to find

Write down decisions where the work happens. Give each page a clear title, a short description and an owner.

| Practice | Our agreement |
| --- | --- |
| Decisions | Record the context, options and outcome |
| Reviews | Ask a teammate to review substantial changes |
| Ownership | Review operational guides every quarter |
| Communication | Link to the source page instead of copying it |

## Meetings

Every meeting has an agenda page. Notes and decisions go on that page during the meeting, not afterwards.
`
  },
  {
    path: 'docs/operations/incident-response',
    author: 'marco',
    title: 'Incident Response',
    description: 'A practical checklist for triage, communication and recovery',
    tags: ['operations', 'runbook'],
    content: `## First response

1. Confirm the impact and appoint an incident lead.
2. Open an incident timeline and record what changed.
3. Stabilize the service before investigating the root cause.
4. Share an update with affected teams every 30 minutes.

> Keep a record of every action. Do not make simultaneous changes without coordination.
{.is-warning}

## Severity levels

| Level | Example | Response |
| --- | --- | --- |
| SEV1 | Wiki unavailable for everyone | Page the on-call engineer immediately |
| SEV2 | Search or sign-in degraded | Respond within one hour |
| SEV3 | Cosmetic issue, workaround exists | Next working day |

## After recovery

Document the cause, follow-up actions and owners. Update the [service catalog](/docs/operations/service-catalog) if ownership changed.
`
  },
  {
    path: 'docs/operations/service-catalog',
    author: 'admin',
    title: 'Service Catalog',
    description: 'Internal services, responsible teams and support channels',
    tags: ['operations', 'reference'],
    content: `## Our services

| Service | Owner | Documentation |
| --- | --- | --- |
| Knowledge workspace | Platform team | [Deployment](/docs/installation/docker) |
| Source control | Engineering | [Git synchronization](/docs/administration/git-sync) |
| Backup and recovery | Operations | [Backup policy](/docs/administration/backups) |
| On-call rotation | Operations | [On-call](/docs/operations/on-call) |

For urgent problems, follow the [incident response guide](/docs/operations/incident-response).
`
  },
  {
    path: 'docs/operations/on-call-draft',
    author: 'marco',
    title: 'On-call',
    description: 'Rotation, handover and escalation',
    tags: ['operations', 'runbook'],
    content: `## Rotation

The on-call week starts on Monday at 09:00. The rotation is published in the team calendar.

## Handover

- Open incidents and their current state
- Planned maintenance for the coming week
- Anything unusual in the monitoring

## Escalation

If you cannot resolve a SEV1 within 30 minutes, call the platform lead.
`
  }
]

// -> Timeline for the screenshots: working hours on weekdays, newest first
function workdayTimestamps (count, start = new Date()) {
  const stamps = []
  let t = new Date(start.getTime() - 25 * 60 * 1000)
  for (let k = 0; k < count; k++) {
    stamps.push(t.toISOString())
    t = new Date(t.getTime() - (2 + (k * 7) % 5) * 60 * 60 * 1000 - ((k * 23) % 50) * 60 * 1000)
    // Outside 07:00–17:00 UTC or on a weekend: continue at the end of the previous working day
    while (t.getUTCHours() < 7 || t.getUTCHours() >= 17 || [0, 6].includes(t.getUTCDay())) {
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - 1, 16, 10 + (k * 13) % 45))
    }
  }
  return stamps
}

// -> SQL that assigns the k-th newest row of a table the k-th timestamp
function timelineSql (table, columns, stamps) {
  const values = stamps.map((ts, k) => `(${k}, '${ts}')`).join(', ')
  const set = columns.map(c => `${c} = (SELECT ts FROM t WHERE t.k = (SELECT COUNT(*) FROM ${table} b WHERE b.id > ${table}.id))`).join(', ')
  return `WITH t(k, ts) AS (VALUES ${values}) UPDATE ${table} SET ${set};`
}

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
  let admin = await login(ADMIN_EMAIL, ADMIN_PASS)
  log('Setup completed')

  await gql(admin, `mutation { site { updateConfig(
    title: "Swissmakers Wiki", company: "Swissmakers", contentLicense: "alr",
    description: "Team knowledge, technical guides and working agreements"
  ) { responseResult { succeeded message } } } }`)

  // -> The administrator is a person, not "Administrator" (shown as author everywhere)
  const userList = async () => (await gql(admin, '{ users { list { id email } } }')).users.list
  const adminId = (await userList()).find(u => u.email === ADMIN_EMAIL).id
  await gql(admin, `mutation ($id: Int!, $n: String!, $j: String!, $l: String!, $tz: String!) {
    users { update(id: $id, name: $n, jobTitle: $j, location: $l, timezone: $tz) { responseResult { succeeded message } } }
  }`, { id: adminId, n: ADMIN_PROFILE.name, j: ADMIN_PROFILE.jobTitle, l: ADMIN_PROFILE.location, tz: TIMEZONE })
  admin = await login(ADMIN_EMAIL, ADMIN_PASS)

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
  const groups = {
    Editors: await group('Editors', editPerms, [
      { id: 'editors-all', deny: false, match: 'START', roles: editPerms, path: '', locales: [] },
      { id: 'editors-admin-ro', deny: true, match: 'START', roles: ['write:pages'], path: 'docs/administration', locales: [] }
    ]),
    Readers: await group('Readers', readPerms, [
      { id: 'readers-all', deny: false, match: 'START', roles: readPerms, path: '', locales: [] }
    ])
  }
  const jwt = { admin }
  for (const usr of people) {
    await gql(admin, `mutation ($e: String!, $n: String!, $g: [Int]!, $p: String!) {
      users { create(email: $e, name: $n, passwordRaw: $p, providerKey: "local", groups: $g, mustChangePassword: false, sendWelcomeEmail: false) { responseResult { succeeded message } } }
    }`, { e: usr.email, n: usr.name, g: [groups[usr.group]], p: USER_PASS })
  }
  const ids = await userList()
  for (const usr of people) {
    await gql(admin, `mutation ($id: Int!, $j: String!, $l: String!, $tz: String!) {
      users { update(id: $id, jobTitle: $j, location: $l, timezone: $tz) { responseResult { succeeded message } } }
    }`, { id: ids.find(u => u.email === usr.email).id, j: usr.jobTitle, l: usr.location, tz: TIMEZONE })
    jwt[usr.key] = await login(usr.email, USER_PASS)
  }
  log(`${people.length + 1} people and 2 groups created`)

  // -> Pages, each created by its owner
  const pageIds = {}
  for (const pg of [...pages.slice(1), pages[0]]) {
    await gql(jwt[pg.author], `mutation ($c: String!, $d: String!, $p: String!, $t: String!, $tags: [String]!) {
      pages { create(content: $c, description: $d, editor: "markdown", isPublished: true, isPrivate: false, locale: "en", path: $p, tags: $tags, title: $t) { responseResult { succeeded message } } }
    }`, { c: pg.content, d: pg.description, p: pg.path, t: pg.title, tags: pg.tags })
    pageIds[pg.path] = (await gql(admin, 'query ($p: String!) { pages { singleByPath(path: $p, locale: "en") { id } } }', { p: pg.path })).pages.singleByPath.id
  }
  const page = p => pages.find(pg => pg.path === p)

  // -> Later edits, a move and a second round of reviews, so the recent changes look lived-in
  const edit = (who, p, changes) => gql(jwt[who], `mutation ($id: Int!, $c: String, $d: String, $t: String, $tags: [String]) {
    pages { update(id: $id, content: $c, description: $d, title: $t, tags: $tags) { responseResult { succeeded message } } }
  }`, { id: pageIds[p], ...changes })
  await gql(admin, 'mutation ($id: Int!) { pages { move(id: $id, destinationPath: "docs/operations/on-call", destinationLocale: "en") { responseResult { succeeded message } } } }', {
    id: pageIds['docs/operations/on-call-draft']
  })
  await edit('anna', 'docs/installation/docker', { c: page('docs/installation/docker').content.replace('## Next steps', '## Health check\n\nThe image reports its health on `/healthz`; the container runs `tini` as PID 1.\n\n## Next steps') })
  await edit('sophie', 'docs/handbook/onboarding', { c: page('docs/handbook/onboarding').content.replace('- [ ] Bookmark', '- [ ] Book a coffee with your onboarding buddy\n- [ ] Bookmark') })
  await edit('admin', 'docs/installation/linux', { d: 'Run Wiki.js NG behind a reverse proxy or standalone' })
  await edit('marco', 'docs/operations/incident-response', { c: page('docs/operations/incident-response').content.replace('every 30 minutes.', 'every 30 minutes in `#incidents`.') })
  log(`${pages.length} pages created and edited`)

  // -> A populated sidebar makes the demo useful as a small company workspace
  const navItems = [
    { kind: 'link', label: 'Wiki home', icon: 'mdi-home-outline', target: '/home' },
    { kind: 'header', label: 'Knowledge base' },
    { kind: 'link', label: 'All documentation', icon: 'mdi-book-open-page-variant-outline', target: '/docs' },
    { kind: 'link', label: 'Installation', icon: 'mdi-server', target: '/docs/installation' },
    { kind: 'link', label: 'Administration', icon: 'mdi-cog-outline', target: '/docs/administration' },
    { kind: 'link', label: 'Development', icon: 'mdi-code-braces', target: '/docs/development' },
    { kind: 'header', label: 'Our team' },
    { kind: 'link', label: 'Team handbook', icon: 'mdi-account-group-outline', target: '/docs/handbook' },
    { kind: 'link', label: 'Operations', icon: 'mdi-lifebuoy', target: '/docs/operations' },
    { kind: 'link', label: 'Recent changes', icon: 'mdi-history', target: '/r' }
  ].map((item, index) => ({ id: `demo-nav-${index}`, targetType: 'external', visibilityMode: 'all', visibilityGroups: [], ...item }))
  await gql(admin, `mutation ($tree: [NavigationTreeInput]!) {
    navigation { updateTree(tree: $tree) { responseResult { succeeded message } } }
  }`, { tree: [{ locale: 'en', items: navItems }] })
  log('Workspace navigation created')

  // -> Assets
  const folderMutation = 'mutation ($slug: String!) { assets { createFolder(parentFolderId: 0, slug: $slug) { responseResult { succeeded message } } } }'
  for (const slug of ['diagrams', 'handbook', 'runbooks']) {
    await gql(admin, folderMutation, { slug })
  }
  const folders = (await gql(admin, '{ assets { folders(parentFolderId: 0) { id slug } } }')).assets.folders
  const folder = slug => folders.find(f => f.slug === slug).id
  const diagram = fs.readFileSync(path.join(__dirname, 'architecture.svg'))
  const text = lines => Buffer.from(lines.join('\n') + '\n')
  const uploads = [
    { name: 'architecture-diagram.svg', folder: 0, data: diagram, type: 'image/svg+xml' },
    { name: 'office-background.jpg', folder: 0, data: fs.readFileSync(path.join(__dirname, '../../client/static/img/login-office.jpg')), type: 'image/jpeg' },
    { name: 'deployment-checklist.txt', folder: 0, data: text(['Deployment checklist', '', '1. Verify the database backup', '2. Pull the approved image', '3. Restart the service', '4. Check /healthz', '5. Confirm sign-in and search']), type: 'text/plain' },
    { name: 'release-notes.txt', folder: 0, data: text(['Workspace release notes', '', 'Updated deployment guide, onboarding checklist and incident response runbook.']), type: 'text/plain' },
    { name: 'architecture-overview.svg', folder: folder('diagrams'), data: diagram, type: 'image/svg+xml' },
    { name: 'onboarding-checklist.txt', folder: folder('handbook'), data: text(['First week', '', '- Accounts and 2FA', '- Working agreements', '- Meet the team']), type: 'text/plain' },
    { name: 'incident-timeline-template.txt', folder: folder('runbooks'), data: text(['Incident timeline', '', 'Time | Action | Who', '---- | ------ | ---']), type: 'text/plain' }
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
  log(`${uploads.length} assets uploaded`)

  // -> Mail pointing at a closed local port: enables the watch UI, never delivers anything
  await gql(admin, `mutation { mail { updateConfig(senderName: "Swissmakers Wiki", senderEmail: "wiki@example.com", host: "127.0.0.1", port: 2525, name: "",
    secure: false, verifySSL: false, user: "", pass: "", useDKIM: false, dkimDomainName: "", dkimKeySelector: "", dkimPrivateKey: "") { responseResult { succeeded message } } } }`)

  // -> Comments: moderation for everyone, so a pending reply shows up
  await gql(admin, 'mutation ($cfg: [KeyValuePairInput]) { comments { updateProviders(providers: [{ isEnabled: true, key: "default", config: $cfg }]) { responseResult { succeeded message } } } }', {
    cfg: [
      { key: 'akismet', value: JSON.stringify({ v: '' }) },
      { key: 'minDelay', value: JSON.stringify({ v: 0 }) },
      { key: 'moderation', value: JSON.stringify({ v: 'all' }) }
    ]
  })
  const comment = async (who, content, replyTo) => {
    const data = await gql(jwt[who], 'mutation ($p: Int!, $c: String!, $r: Int) { comments { create(pageId: $p, content: $c, replyTo: $r) { responseResult { succeeded message } id isPending } } }', {
      p: pageIds.home, c: content, r: replyTo
    })
    // -> comments.create is rate limited to one call per 15 seconds
    await sleep(16000)
    return data.comments.create
  }
  const approve = id => gql(admin, 'mutation ($id: Int!) { comments { approve(id: $id) { responseResult { succeeded message } } } }', { id })
  const question = await comment('jonas', 'Is there a recommended way to back up the Git repository as well, or is the database dump enough?')
  await approve(question.id)
  await comment('admin', 'The database dump is enough — the repository can always be rebuilt from it. The schedule is on the Backups page.', question.id)
  await comment('anna', 'We also keep the data folder in the nightly NAS backup, so a restore is faster.', question.id)
  const announcement = await comment('marco', 'Heads-up: the upgrade to 2.8.1 is planned for Thursday evening. The wiki will be read-only for about ten minutes.')
  await approve(announcement.id)
  log('Comments created')

  // -> Bookmarks and watches of the administrator
  for (const p of ['home', 'docs/installation/docker', 'docs/administration/backups', 'docs/handbook/onboarding', 'docs/operations/incident-response']) {
    await gql(admin, 'mutation ($id: Int!) { bookmarks { toggle(pageId: $id) { responseResult { succeeded message } } } }', { id: pageIds[p] })
  }
  await gql(admin, 'mutation ($id: Int!) { watches { watchPage(pageId: $id) { responseResult { succeeded message } } } }', { id: pageIds['docs/installation/docker'] })
  await gql(admin, 'mutation { watches { watchPath(locale: "en", path: "docs/administration") { responseResult { succeeded message } } } }')
  log('Bookmarks and watches created')

  if (TIMELINE_FILE) {
    const activity = workdayTimestamps(80)
    const sql = [
      timelineSql('pageActivity', ['createdAt'], activity),
      // Page dates follow their activity; versions are dated at the page's creation
      `UPDATE pages SET createdAt = (SELECT MIN(a.createdAt) FROM pageActivity a WHERE a.pageId = pages.id),
        updatedAt = (SELECT MAX(a.createdAt) FROM pageActivity a WHERE a.pageId = pages.id)
        WHERE EXISTS (SELECT 1 FROM pageActivity a WHERE a.pageId = pages.id);`,
      `UPDATE pageHistory SET versionDate = (SELECT MIN(a.createdAt) FROM pageActivity a WHERE a.pageId = pageHistory.pageId),
        createdAt = (SELECT MAX(a.createdAt) FROM pageActivity a WHERE a.pageId = pageHistory.pageId)
        WHERE EXISTS (SELECT 1 FROM pageActivity a WHERE a.pageId = pageHistory.pageId);`,
      // Assets were uploaded over the previous working days
      timelineSql('assets', ['createdAt', 'updatedAt'], workdayTimestamps(20, new Date(Date.now() - 24 * 3600 * 1000))),
      // Discussion over the last two days: replies after their question
      timelineSql('comments', ['createdAt', 'updatedAt'], [3, 19, 22, 26, 30].map(h => new Date(Date.now() - h * 3600 * 1000).toISOString()))
    ]
    fs.writeFileSync(TIMELINE_FILE, sql.join('\n') + '\n')
    log(`Timeline written to ${TIMELINE_FILE}`)
  }

  console.log(admin)
}

main().catch(err => {
  console.error(`!! ${err.message}`)
  process.exit(1)
})
