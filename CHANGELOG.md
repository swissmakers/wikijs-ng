# Changelog

All notable changes to **wikijs-ng** (fork of [Requarks/wiki](https://github.com/Requarks/wiki) 2.x) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.7.0] - Unreleased

### Added — navigation & content discovery

- **Folder view for virtual folders.** Navigating to a path that has no page of its own but *does* have child pages (e.g. clicking an intermediate breadcrumb segment) now renders a proper folder page with the normal chrome (header, sidebar, breadcrumbs) listing all subfolders and pages the user may read, plus a "Create this page" action for editors. Previously this was a dead-end fullscreen splash. Backed by a new `pages.treeByPath` GraphQL query (permission-filtered) and a `folder` server view; the browse sidebar now also recovers when the current path is a folder instead of silently staying empty.
- **Scoped search.** The search overlay gained filter chips to restrict results to the current locale and/or the current path subtree — the server side of this existed but was never exposed in the UI.
- **Tag browser improvements**: a filter box for the tag list, per-tag page counts, and the `?sort=` URL parameter is no longer appended when the default order is active.

### Added — search

- **New MariaDB/MySQL search engine** (`Database - MariaDB / MySQL`) using InnoDB FULLTEXT indexes over title, description *and page content* with relevance ranking (title matches boosted), boolean-mode prefix fallback for partial words, real total hit counts and title-based suggestions. New installations on MariaDB/MySQL get it by default; existing installations can enable it under Admin → Search Engine (then Rebuild Index). Ops note: set `innodb_ft_min_token_size=2` (and rebuild the index) if 2-character terms must be searchable.
- The basic database engine now tokenizes the query (all words must match, in any field), orders title matches first, returns real totals and offers title-prefix suggestions.

### Added — editing

- **Server-side drafts with autosave.** The editor saves a draft (per user + page) every 30 seconds while you type. Reopening the editor after a crash, closed tab or losing an edit session offers to restore or discard the draft; drafts are cleared automatically on successful save.
- **Page templates.** Any page can be marked "Use as Template" in the page properties. Templates appear as one-click starting points in the new-page dialog (reusing the existing copy-from-page mechanism), are excluded from search indexing, and only require read access to be used.
- Inserting a page link from an editor now uses the target page's **title** as the link text instead of the last path segment.
- The page selector dialog gained **search-as-you-type** (by title, with path shown), page paths under each title in the browse list, and a "Recent" section of the last 8 selected pages.

### Added — asset management

- **Full folder management**: rename, move and delete asset folders (with optional recursive delete of contents) — previously folders could only ever be created. All operations recompute the affected asset hashes, flush caches and emit the proper storage events, so git/disk/S3/Azure sync targets follow along (moves become `git mv`, not delete+add).
- **Move assets between folders**, from the editor's media manager (new Move action) and the new admin area.
- **New Admin → Assets page**: full-page asset manager with a folder tree, sortable file table, multi-select bulk move/delete, uploads into any folder, and drag & drop of files onto folders to move them. A header shortcut ("Images & Files") appears for users with asset permissions.
- Server-side sorting arguments on the asset list API and a one-request `folderTree` query.

### Added — administration

- **Page rule presets and import/export**: the group page-rules editor's overflow menu now works — three starter presets (read-only / editors / restricted section), JSON export of a group's rules, and JSON import with validation and regenerated rule IDs.
- Vendored **English and German locale files** (`server/locales/en.yml`, `de.yml`) are always loaded as the base translation layer, with database strings (downloaded packs, admin overrides) on top. A fresh install now renders a fully translated UI with **no connection to the upstream localization service**; the optional daily sync still works when enabled.

### Changed — user interface

- **System pages redesigned** (page-not-found, create-page prompt, unauthorized, welcome, error) as centered cards on the brand gradient, matching the login screen; the create-page prompt no longer shows a "deleted file" icon.
- **Page view refresh**: larger navy page title with the tags shown as chips directly in the header, an author/date footer strip under the content (freeing the sidebar), a table-of-contents with active-section highlighting (scroll-spy) instead of chevron rows, a collapsible TOC above the content on tablet/mobile, better content line-height and heading rhythm, and the edit speed-dial no longer collides with the footer on phones.
- **Admin area polish**: modernized page headers (icon in a tinted tile), content constrained to a readable width on ultra-wide screens, active sidebar item highlight fixed (stale Vuetify 1 selector), and a new Assets entry in the Site section.
- **Profile area polish** (`/p/profile`, `/p/pages`): same modernized header treatment as the admin area, brand-colored card toolbars instead of the old blue-grey/purple/teal mix, content width constrained, a quick-filter box on the "My Pages" list, and the fake "Comments posted: 0" stat removed.
- **Dark mode: readable primary-colored text.** The dark theme's deep primary (`#0f3c78`) stays on surfaces (buttons, header), but `primary--text`, links (`anchor`) and `info` elements now use a readable light blue (`#659DE7`) — tag chips, overline titles and in-content links are legible again.
- Removed remaining upstream `docs.requarks.io` help links from the admin pages and page selector.

### Fixed

- `assetFolders` model: the `parent` relation joined on the wrong column and `getAllPaths()` could crash on a missing parent — both fixed (required for the new folder operations).
- Tag browsing: multi-tag selection duplicates removed; sort parameter comparison bug fixed.

### Removed — dead weight ("coming soon" stubs)

- Stub admin pages that only said "coming soon": Editor, Logging (+ live console), Extensions (read-only, uninstallable); their routes are gone.
- The dead puppeteer extension (its availability check tested for the wrong binary and nothing ever called it), the empty Solr/Sphinx/Manticore search engine stubs, the commented-out page rating/bookmark/comment-count widgets, the "My Wiki" and site-map menu remnants, the profile "Comments" stub page, the disabled recycle-bin button, ratings/personal-wikis admin toggles, and the dead `tag.js` resolver (100% commented-out code).
- `theme.yml` no longer declares broken, unwired theme props (`showTags` was declared three times).

### Database

- New migrations `2.7.0` (asset folder/file indexes), `2.7.1` (`pageDrafts` table), `2.7.2` (`pages.isTemplate` column). Applied automatically on first start.

## [2.6.0] - Unreleased

### Changed — User interface refresh (Swissmakers branding)

- **New brand color scheme** applied through a proper Vuetify theme map (previously none existed — the UI ran on stock Material blue): primary `#2A5BD6`, navy `#00204B` for the top navigation and dark surfaces, matching light/dark palettes. The parallel SCSS theme map (`mc('theme', …)`) is kept in sync.
- Navigation header, sidebar, admin area, page view (TOC/tags/history), dialogs and forms now follow the theme; hardcoded `blue`/`indigo`/`teal`/`deep-purple` accents on the main surfaces were replaced.
- **Login page redesigned** as a centered enterprise card (Red Hat SSO style): compact white card with centered logo/title and outlined fields on a calm navy/brand gradient — the stock photo background is gone; a configured `loginBgUrl` still takes precedence. When the selected strategy accepts usernames, the field now indicates that both username and email work.
- **LDAP: users can sign in with username or email.** The default search filter now matches both attributes (`(|(uid={{username}})(mail={{username}}))`) and the setting's help text documents the Active Directory variant. Existing installations keep their configured filter — extend it accordingly to enable email sign-in.
- Dialog headers are flat brand surfaces instead of radial gradients; dashboard stat tiles use a primary/navy ramp; PWA `theme_color` and browser meta colors updated; dead favicon references removed.
- **`/a/contribute` rebuilt** as a factual "About Wiki.js NG" page (project links, GitHub Sponsors, commercial support, upstream AGPL attribution). All upstream fundraising content is gone: PayPal button, Ethereum address, Patreon/OpenCollective/T-shirt links, sponsor logos hotlinked from the upstream CDN, and the dashboard promo card.

### Removed — upstream services and dead weight

- **Unauthenticated `contribute` GraphQL query removed** — it let any caller make the server issue outbound requests to the upstream sponsor API.
- **Update-check and container self-upgrade removed**: the daily `checkForUpdates` call to the upstream service, the `latestVersion`/`upgradeCapable` API fields and the admin "Perform Upgrade" button (which relied on upstream's update-companion container and could have pulled the upstream image over this fork). Translation downloads are unchanged.
- Upstream CI and packaging: GitHub workflows (`build`/`helm`/`packer` — the build workflow fired on every push and pushed `requarks/wiki` image tags), issue-template redirection to the upstream tracker, reviewer auto-assign, DigitalOcean packer image, upstream Helm chart, the abandoned Go installer (contained a hardcoded Bugsnag API key), the Solr stub, the broken "Firebase" auth module (it actually instantiated the GitHub strategy), orphaned admin pages (`webhooks`, `stats`), dead vendored client libs and unused GraphQL documents.
- Fixed defaults that leaked to upstream infrastructure: PlantUML renders now default to `plantuml.com` instead of upstream's server, the Let's Encrypt contact default no longer points at upstream's security mailbox, and sample configs use `changeme` instead of a project-branded password.
- Container images now define a `HEALTHCHECK` (the `/healthz` endpoint existed but was never wired up).

### Added — operations

- `dev/deploy-test.sh`: generic build / test / cleanup helper — builds the image locally (`--format docker`, so the `HEALTHCHECK` survives; OCI images silently drop it) and runs a throwaway instance on port 3006 with its own SQLite volume for verifying changes before committing. Production deployments always use the CI/CD-built registry images. Documented in `dev/BUILD.md`, together with a "Running fully offline" section in the README.

### Removed

- **Telemetry removed entirely.** The hardened image no longer phones home: the telemetry module, its kernel/setup hooks, the GraphQL mutations and query fields (`setTelemetry`, `resetTelemetryClientId`, `telemetry`, `telemetryClientId`), the admin utility page, the setup-wizard opt-in and the related config defaults are gone. (The version update check and the translation download still contact the upstream service — see the notes in the README if you want to run fully offline.)
- **CAS authentication and SFTP storage modules dropped.** Both were built on packages abandoned since 2013/2016 and were the sole source of four findings (`underscore` 1.6.0 critical, `xml2js` 0.4.4, `node-uuid` 1.4.1, `ip-address` 5.9.4 — the last one had no fix available at all). Existing installations that used them will see the strategy/target disappear automatically.
- Dead dependencies: `image-size`, `markdown-it-external-links`, `markdown-it-mathjax` (none were imported anywhere).

### Fixed

- **Release images are no longer flagged as a development build.** `package.json` now ships `dev: false`, and the Gitea release workflow enforces it — the red "DEVELOPMENT VERSION / NOT for production use" banner in the navigation bar and setup wizard is gone.
- **Brute-force protection rebuilt** on `rate-limiter-flexible` (`server/helpers/brute-force.js`), replacing the unmaintained `express-brute` and its deep internal import. Same behaviour (5 free attempts, then a temporary lock, reset on successful login); database-backed on PostgreSQL/MySQL/MariaDB, in-process on SQLite/MS SQL Server.
- **Git storage keeps working with simple-git 3.36**, which blocks `core.sshCommand` (and `GIT_SSH_COMMAND`) by default — SSH-authenticated repositories would otherwise fail to initialise. The module now enables exactly the required protection categories, and only when the corresponding option is actually configured.

### Security — dependency updates

Closes the findings of a Trivy scan of the published image (5 critical, ~45 high).

- Vulnerable chains eliminated through parent upgrades: `sqlite3` 6.0.1 (drops `tar` 6.x with its nine advisories, plus `node-gyp` 8, `make-fetch-happen` 9, `cacache` 15, `@tootallnate/once`), `express` 4.22.2 + `body-parser` 1.20.6 (pulls fixed `path-to-regexp` and `qs`), `passport-microsoft` 2.1.0 (fixed `passport-oauth2`), `diff2html` 3.4.56 (drops the bundled `highlight.js` 10.x).
- Direct upgrades: `simple-git` 3.36.0, `multer` 2.2.0, `nodemailer` 8.0.11, `@apollo/server` 5.5.1, `i18next-http-middleware` 3.9.8, `js-yaml` 4.3.2, `lodash` 4.18.1, `dompurify` 3.4.14, `nanoid` 3.3.18, `ws` 8.21.3, `tar-fs` 2.1.5, `uuid` 11.1.1, `diff` 4.0.4, `highlight.js` 11.12.0.
- Markdown rendering stack modernised (closes the `linkify-it` advisories): `markdown-it` 14.3.1 with `markdown-it-abbr` 2, `-sub` 2, `-sup` 2, `-mark` 4, `-footnote` 4, `-attrs` 5.0.1, `-emoji` 3.1.0, `-multimd-table` 4.2.3. `cheerio` 1.2.0 replaces the release candidate and removes the vulnerable `css-what` 4.
- Container images run `apk upgrade` during the build so base-image packages (OpenSSL et al.) always carry the current Alpine patches.

### Known, accepted findings

`validate.js`, `markdown-it-decorate` and `string-math` (via `markdown-it-pivot-table`) have no fixed release available; all three are last-published versions of dormant projects with limited attack surface (input validation and markdown post-processing on already sanitised content). They are re-evaluated with every release.

### Added

- **Rebranding to "Wiki.js NG"** across all user-visible surfaces: boot banner, default site title, setup wizard, PWA manifest, footer link (now pointing to the fork repository), admin UI copy, mail footer/`x-mailer`, installer, config sample. Functional identifiers deliberately untouched: JWT issuer/audience (`urn:wiki.js` — changing it would invalidate all sessions and API keys), i18next keys (translations come from the upstream locale service), migration IDs, `package.json` name
- Version bumped to **2.6.0** (`BASE_DEV_VERSION`, SECURITY.md support table updated; `minimumNodeRequired` corrected to 24.0.0). The default site logo no longer loads from the Requarks CDN but from the bundled local asset
- Git storage: new **Operation Timeout** setting (default 300 s) — a hanging remote operation is terminated instead of blocking all subsequent commits and syncs forever
- `server/helpers/mutex.js`: small FIFO promise lock used by the git storage module

### Fixed — Git storage sync reliability

Production symptoms addressed: `spawn git EAGAIN` after prolonged uptime, bi-directional sync permanently breaking after external pushes, and articles never reaching the git repository (requiring manual "Add Untracked Changes" + "Force Sync").

- **Scheduler hot-loop bug** (`server/models/storage.js`): the internal sync job was registered with the DB row's (nonexistent) `internalSchedule` instead of the module definition's — `moment.duration(undefined)` is 0 ms, so with the Disk target enabled a sync-storage job re-armed **every event-loop tick**, exhausting processes/CPU (primary `EAGAIN` source). Sync intervals are now also validated, with fallback to the module default
- **Bounded worker forks**: page renders/tree rebuilds fork one Node process each with no cap or timeout — now limited to 3 concurrent forks (FIFO queue) with a 10-minute kill timeout (`server/core/scheduler.js`)
- **Self-healing sync**: every sync first aborts any interrupted rebase and commits leftover untracked/staged changes ("absorb pending changes") — files stranded by earlier failures are picked up automatically; manual "Add Untracked Changes" is no longer needed
- **Deterministic conflict handling**: `pull --rebase` runs with `-X theirs` (the local wiki edit wins; both sides converge on the following push). A failed rebase is aborted automatically instead of wedging the repository permanently
- **No more lost change windows**: the last imported commit hash is persisted (`.git/wikijs-sync.json`); pulled changes are imported into the DB *before* pushing, and a rejected push is retried once after re-pulling — previously a push failure silently skipped the import and lost that diff window forever
- **Single-flight locking**: scheduled sync, Force Sync, admin "Apply", purge, import and all page/asset commit handlers are serialized through a mutex — no more interleaved git operations corrupting each other
- Failed storage-target initialization now removes the target from the event dispatch list (page saves no longer hit half-initialized modules)
- `.gitignore`d pages are now logged loudly when skipped instead of silently never committed; the rename handler gained the same guard
- **Asset binary corruption**: git storage wrote uploaded assets with `utf8` encoding, corrupting every binary file — fixed
- "Add Untracked Changes" / "Import Everything" no longer hang forever when a single file fails (stream callback bug)
- `render-page` job continued after destroying its DB pool on empty content; page paths containing dots were mangled on git import (`getPagePath` join bug)

### Changed

- Admin → System now compares versions with semver instead of strict equality — a fork version newer than upstream no longer shows a bogus "upgrade available" (which could have pulled the upstream Docker image)

## [Modernization] - 2026-08-26

Full dependency and toolchain modernization of the 2.x codebase, Node.js 24 enforcement, and a new Gitea-based container build pipeline. This is the first divergence from upstream after the fork.

### Added

- Gitea Actions workflow `.gitea/workflows/build-harbor.yml`: builds a multi-arch image (linux/amd64, linux/arm64) with podman on push to `main` and pushes it to Harbor, Docker Hub and GHCR as `wikijs-ng` (tags: commit SHA, `v<version>` from `package.json`, `latest`). Version is extracted with plain `sed` (no `jq` required on the runner)
- `dev/BUILD.md`: how to build and run the image locally with Podman (rootless subuid setup, single- and multi-arch, run examples)
- `.dockerignore` (keeps `node_modules`, `assets`, `.webpack-cache`, `.git` etc. out of the build context)
- `patches/babel-plugin-lodash+3.3.4.patch`: replaces the deprecated `isModuleDeclaration` call with `isImportOrExportDeclaration` (silences the Babel deprecation printed on every build)
- `dev/webpack/webpack.common.js`: shared webpack base (entries, rules, plugins, resolve) — `webpack.prod.js` / `webpack.dev.js` now only contain their deltas
- OCI image labels (`org.opencontainers.image.*`) and `VERSION` / `REVISION` / `CREATED` build args in `dev/build/Dockerfile`; maintainer label changed to swissmakers.ch
- `cypress.config.js` (Cypress 13+ config format)
- New SAML strategy option **Require signed response** (`wantAuthnResponseSigned`), exposed in the admin UI (`@node-saml` v5 defaults to `true`; the fork defaults to `false` to preserve existing IdP setups)
- Browser polyfills required by Webpack 5 (`buffer`, `process`, `util`, `stream-browserify`) — the client uses `Buffer` for base64 page metadata decoding
- `jest` configuration in `package.json` (`testEnvironment: node`, roots limited to `server/` so Cypress specs are not picked up)

### Security

- **passport-saml 3.2.4 → @node-saml/passport-saml 5.1.0** — removes the forced `xml-crypto 2.1.6` resolution (signature-bypass CVEs); the tree now resolves `xml-crypto ^6.1.2` only
- **passport 0.4.1 → 0.7.0** (session-fixation fix from 0.6.0)
- **multer 1.4.4 → 2.0.2** (multiple CVEs in the 1.x line)
- Removed deprecated **`request` / `request-promise` / `apollo-fetch`** (vulnerable `tough-cookie` / `form-data` transitive chain) in favor of native `fetch` on Node 24; small shared helper in `server/helpers/graph-fetch.js`
- **aws-sdk v2 (end-of-support) → AWS SDK v3** (`@aws-sdk/client-s3`, `@aws-sdk/client-cloudsearch`, `@aws-sdk/client-cloudsearch-domain`)
- **raven (deprecated) → @sentry/node 10**
- **subscriptions-transport-ws (unmaintained, DoS issues) → graphql-ws 5** on both server and client
- **mermaid 8.8 → 11.17** (XSS advisories in 8.x), **prismjs 1.22 → 1.30** (ReDoS / DOM clobbering), **katex 0.12 → 0.16**, **highlight.js 10 → 11.11**, **dompurify** already current
- Express 4.21.2, body-parser 1.20.3, nanoid 3.3.11, jsonwebtoken 9, express-session 1.18.2 and further in-line security bumps
- **`yarn.lock` regenerated from scratch** (21k → 15k lines): removes stale vulnerable transitives such as `minimist 0.x`, `loader-utils 1.x`, `json-schema 0.2.3`, `node-fetch < 2.6.7`, `tough-cookie 2.x`, `nth-check 1.x`, `ip 1.x`
- `dev/build/Dockerfile` now copies `yarn.lock` into the build stage — previously `yarn --frozen-lockfile` ran **without** a lockfile, silently installing floating transitive versions (non-reproducible builds)

### Changed

- **Node.js >= 24 required**: `engines` in `package.json`, runtime check in `server/setup.js`, installer check in `dev/installer/syscheck.go`, `.nvmrc` → v24.18.0
- **Webpack 4 → 5** (`dev/webpack/webpack.prod.js`, `dev/webpack/webpack.dev.js`):
  - `NODE_OPTIONS=--openssl-legacy-provider` removed from all scripts (`cross-env` dropped)
  - filesystem cache replaces `cache-loader`; asset modules replace `url-loader` / `file-loader` / `raw-loader`; `css-minimizer-webpack-plugin` replaces `optimize-css-assets-webpack-plugin` + `cssnano`; content-hashed output filenames (`js/[name].[contenthash:8].js`)
  - toolchain: webpack-cli 6, babel-loader 9, css-loader 7, style-loader 4, sass 1.77 + sass-loader 16 (modern API, `indentedSyntax` for Vuetify `.sass`), PostCSS 8 (autoprefixer 10), mini-css-extract-plugin 2, html-webpack-plugin 5 + html-webpack-pug-plugin 4, copy-webpack-plugin 12, webpackbar 7, webpack-dev-middleware 7 (`writeToDisk` replaces write-file-webpack-plugin)
  - Babel cleanup: all `@babel/plugin-proposal-*` / `plugin-syntax-*` removed (covered by `@babel/preset-env` 7.29), core-js 3.50
- **Vue 2.6.14 → 2.7.16**, **Vuetify 2.3.15 → 2.7.2**, vue-router 3.6.5, vuex 3.6.2, vue-loader 15.11; `vue-template-compiler` removed (Vue 2.7 ships its own compiler)
- **GraphQL server stack** (must be deployed together with the client changes):
  - Apollo Server 2 → **@apollo/server 5** + `@as-integrations/express4` (`allowBatchedHttpRequests`, `csrfPrevention`)
  - graphql 15.3 → **16.11**, `graphql-tools` 7 → `@graphql-tools/schema` / `@graphql-tools/utils`
  - `@auth` directive rewritten from `SchemaDirectiveVisitor` to a `mapSchema` transformer (same semantics)
  - `graphql-rate-limit-directive` 1 → 2 (new `rateLimitDirective()` API, requires peer `rate-limiter-flexible`)
  - subscriptions served via **graphql-ws** (`graphql-transport-ws` protocol) on `/graphql-subscriptions` with the same JWT + `manage:system` gate; `graphql-subscriptions` 3 (`asyncIterableIterator`)
- **GraphQL client**: apollo-client 2 + `apollo-link-*` / `apollo-cache-inmemory` → **@apollo/client 3.14** (`/core` entry, `BatchHttpLink`, `onError`, `GraphQLWsLink`); vue-apollo 3.1.2; graphql-tag 2.12.6
- **Database layer**: knex 0.21 → **3.1**, objection 2 → **3.1**, connect-session-knex 2 → **5** (new `ConnectSessionKnexStore` API); `mssql` package replaced by knex 3's native **tedious** driver (connection config mapped to `server` + `options{}`)
- **i18next 19 → 25** with **i18next-http-middleware** (replaces deprecated i18next-express-middleware); mongodb driver 3 → 6 (promise API in v1-import paths); js-yaml 3 → 4 (`safeLoad` → `load`); luxon 1 → 3; jsdom 16 → 26; nodemailer 6 → 7; uuid 9 → 11; node-2fa 2; d3 6 → 7; codemirror 5.65 (staying on the v5 line)
- **Lint/test tooling**: ESLint 7 → **8.57** with `eslint-config-standard` 17 and `@babel/eslint-parser` (replaces the dead `eslint-config-requarks` / `babel-eslint`); eslint-plugin-vue 9 (Vue 2 configs); Jest 26 → **29**; Cypress 5 → **13** (`cypress.json` → `cypress.config.js`). New standard@17 style findings are parked via a `rules:` block in `.eslintrc.yml` for incremental cleanup
- GitHub `build.yml` Windows job: obsolete `extract-files` patch workaround steps removed (the patched package left the dependency tree)
- Build warnings eliminated: removed `graphql-persisted-document-loader` (its `documentId` output was never consumed; drops the ancient `persistgraphql` → `apollo-client@1` chain and with it the graphql-0.10 resolution warnings — the `resolutions` field in `package.json` is gone entirely), removed the unused Modernizr stack (`webpack-modernizr-loader`, `client/.modernizrrc.js`, vendored `client/libs/modernizr/` — the generated `mdz-*` class was referenced nowhere), pinned `rate-limiter-flexible` to 5.0.5 and bumped `pug-plain-loader` to 1.1.0 (peer ranges satisfied), added `@opentelemetry/core` as a direct dependency (Sentry peer), set `"private": true`
- Production minification runs with bounded parallelism (`terser-webpack-plugin` / `css-minimizer-webpack-plugin` with `parallel: 2`) so builds no longer exhaust memory on small hosts or under QEMU emulation in CI
- Both build Dockerfiles set `NODE_OPTIONS=--no-deprecation` in the build stage (silences Yarn 1's `url.parse()` DEP0169 noise under Node 24); `dev/build-arm/Dockerfile` now carries the same OCI labels, build args and `--no-deprecation` CMD as the main Dockerfile, copies `yarn.lock`, and skips the Cypress binary download (`CYPRESS_INSTALL_BINARY=0` in the main Dockerfile)
- Sentry logging module rewritten as a proper winston 3 `Transport` subclass using `@sentry/node` (the old transport still used the winston 2 API and silently mis-fired under winston 3)

### Fixed

- **Group permissions corruption under objection 3**: JSON columns (`groups.permissions`, `groups.pageRules`, `pages.extra`) were double-stringified on insert because the old code passed pre-stringified values; all call sites now pass raw objects (`server/setup.js`, group/system resolvers, pages model). Without this fix, JWTs carried unusable permission strings and every `@auth` check failed
- `users` model JSON schema: `tfaSecret` type `['string', null]` → `['string', 'null']` (ajv 8 rejects `null` as a type value)
- `html-image-prefetch` renderer: binary image handling was broken (decoded the body as a string before base64-encoding); now uses `arrayBuffer()` correctly
- `/logout` uses the callback form of `req.logout()` (required by passport 0.6+)
- Stale `node/no-deprecated-api` eslint-disable reference and a handful of legacy lint errors (unused imports, stray semicolons)

### Removed

- Unused/dead dependencies (~25): `offline-plugin`, `webpack-subresource-integrity`, `duplicate-package-checker-webpack-plugin`, `simple-progress-webpack-plugin`, `script-ext-html-webpack-plugin`, `webpack-merge`, `pug-loader`, `resolve-url-loader`, `ignore-loader`, `raw-loader`, `postcss-cssnext`, `postcss-import`, `postcss-preset-env`, `postcss-selector-parser`, `postcss-flexibility`, `apollo-link-persisted-queries`, `apollo-link-http`, `chart.js`, `vue-chartjs`, `@vue/babel-preset-app`, `babel-plugin-transform-imports`, `@babel/polyfill`, `vue-hot-reload-api`, `terser`, `webpack-bundle-analyzer`, `@babel/cli`, `file-type`, `i18next-node-fs-backend`
- `patches/extract-files+9.0.0.patch` (only needed by the removed `graphql-tools@7` chain)
- Vendored `client/libs/prism/` (dead code, superseded by the npm `prismjs` build)
- `cypress.json` (replaced by `cypress.config.js`)

### Known limitations / deliberately not upgraded

- **Express stays on 4.21.x** — Express 5 is blocked by `app.options('*')` / `app.get('*')` wildcard routes, `express-brute` (unmaintained) and the i18next middleware; revisit later
- markdown-it 11 stack and its plugins (plugin compatibility with newer majors unverified; no known critical CVE)
- CodeMirror stays on the 5.x line (v6 is a full rewrite)
- `express-brute` and archived `passport-azure-ad` kept as-is (tech debt)
- Vue 3 / Vuetify 3 are out of scope — that is effectively upstream's Wiki.js 3.0 rewrite
