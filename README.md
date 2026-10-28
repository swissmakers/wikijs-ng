# Wiki.js NG

[![Release](https://img.shields.io/github/release/swissmakers/wikijs-ng.svg?style=flat&maxAge=3600)](https://github.com/swissmakers/wikijs-ng/releases)
[![License](https://img.shields.io/badge/license-AGPLv3-blue.svg?style=flat)](https://github.com/swissmakers/wikijs-ng/blob/main/LICENSE)
[![Docker Pulls](https://img.shields.io/docker/pulls/swissmakers/wikijs-ng.svg?logo=docker&logoColor=white)](https://hub.docker.com/r/swissmakers/wikijs-ng)
[![GitHub Sponsors](https://img.shields.io/badge/sponsor-github-ea4aaa?logo=github)](https://github.com/sponsors/swissmakers)
[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-green.svg?style=flat&logo=javascript&logoColor=white)](http://standardjs.com/)

**Wiki.js NG** is a hardened, actively maintained fork of Wiki.js 2.x — the modern, lightweight and powerful wiki engine built on Node.js.

Wiki.js NG is maintained by [Swissmakers GmbH](https://swissmakers.ch) and focuses on long-term operability: a current runtime and dependency baseline, closed security findings and reliability fixes for enterprise deployments — while remaining fully compatible with existing Wiki.js installations and content.

## Overview

Wiki.js NG provides a complete, self-hosted knowledge management platform:

- Markdown, visual (WYSIWYG), code, and AsciiDoc editors
- Full-text search: built-in database search, MariaDB/MySQL and PostgreSQL full-text, Elasticsearch 7/8, Algolia, AWS CloudSearch and Azure Search
- Fine-grained access control with groups and page rules
- Authentication via local accounts, LDAP, SAML 2.0, OpenID Connect, OAuth2 and numerous social providers
- Bi-directional Git synchronization, plus backups to local disk, S3 / S3-compatible storage (incl. DigitalOcean Spaces) and Azure Blob Storage
- Runs on PostgreSQL (recommended), MySQL, MariaDB, SQLite or MS SQL Server

For end-user and administration documentation, the upstream [Wiki.js 2.x documentation](https://docs.requarks.io/) remains applicable.

## What is different in Wiki.js NG

| Area | Change |
| --- | --- |
| Runtime | Node.js 24 baseline (enforced at setup, install and image level) |
| Dependency baseline | Fully modernized stack -> Webpack 5, Vue 2.7 / Vuetify 2.7, Apollo Server 5 + GraphQL 16, Knex 3 / Objection 3, AWS SDK v3, current passport / @node-saml |
| Security | Removed EOL and vulnerable packages (`request`, `aws-sdk` v2, `subscriptions-transport-ws`, `raven`, multer 1.x, forced legacy `xml-crypto` and many more), optional Content Security Policy that works without `'unsafe-eval'`, visual editor on CKEditor 5 v48, self-service two-factor authentication |
| Offline | No upstream services: bundled translations (English, German, French, Italian) and module logos, no update checks, no telemetry |
| Collaboration | Watch pages and folders with e-mail digests, bookmarks, recent changes, RSS feed and sitemap, backlinks, comment replies and moderation, PDF export, keyboard shortcuts, light/dark mode that follows the system |
| Administration | Permission inspector (shows which page rule decides), asset manager with folder operations, comment moderation queue, browsable folder views |
| Git storage | Hardened bi-directional sync: self-healing after failed or interrupted operations, deterministic conflict resolution, only changes from the remote are imported (wiki edits keep their author) |
| Stability | A failing storage target never fails a page save, init process in the image (no zombie processes), bounded background workers, scheduler fixes, resource-aware build tooling |
| Delivery | Reproducible multi-arch container images (amd64 / arm64) with OCI metadata, published to Docker Hub and GHCR |

See the [CHANGELOG](CHANGELOG.md) for the complete list of changes since the fork.

## A quick look

The screenshots are generated with `dev/screenshots.sh` (see [`dev/BUILD.md`](dev/BUILD.md)) from a seeded demo workspace: a fictional team with five people, about fifteen pages and two weeks of history. The suite checks settings persistence, contrast and phone layouts, and captures both dark and light themes.

Light theme previews: [article](docs/screenshots/page-view-light.png), [formatting](docs/screenshots/article-formatting-light.png), [folders](docs/screenshots/folder-view-light.png), [search](docs/screenshots/search-light.png), [bookmarks](docs/screenshots/bookmarks-light.png), [recent changes](docs/screenshots/recent-changes-light.png), [comments](docs/screenshots/comments-light.png), [permissions](docs/screenshots/access-inspector-light.png), and [assets](docs/screenshots/admin-assets-light.png).

**Refreshed page design** -> tags in the page header, table of contents with active-section highlighting, bookmark and watch buttons next to the page actions, backlinks and an author footer under the content.

![Page view](docs/screenshots/page-view.png)

**Browsable folder views** -> navigating to a path without a page of its own no longer dead-ends. You get a folder page listing all subfolders and child pages, and you can watch the whole folder from there.

![Folder view](docs/screenshots/folder-view.png)

**Full-text search with scoping** -> the database search engines index the actual page content with relevance ranking, and results can be restricted to the current locale or path subtree.

![Search](docs/screenshots/search.png)

**Recent changes** -> every change grouped by day, with folder and language filters and an RSS feed. Changes imported by a storage sync are marked as such.

![Recent changes](docs/screenshots/recent-changes.png)

**Comment threads and moderation** -> replies are grouped under their comment, and new comments can be held until a moderator approves them, inline or in the moderation queue.

![Comments](docs/screenshots/comments.png)

**Permission inspector** -> pick a user or group and see for every permission whether it is granted on a page and which page rule decides it.

![Permission inspector](docs/screenshots/access-inspector.png)

**Bookmarks and watched pages** -> star pages to find them again, watch pages or folders to get an e-mail digest of the changes.

![Bookmarks](docs/screenshots/bookmarks.png)

**Asset management** -> full admin file manager with folder rename/move/delete, bulk operations and drag & drop, backed by proper storage-sync events (Git sees moves as moves).

![Assets admin](docs/screenshots/admin-assets.png)

**Enterprise-style login** -> a focused sign-in panel with an Unsplash office photograph and all configured authentication strategies.

![Login](docs/screenshots/login.jpg)

## Getting started

### Prebuilt container images (recommended)

Images are published for `linux/amd64` and `linux/arm64`:

| Registry | Image |
| --- | --- |
| Docker Hub | [`swissmakers/wikijs-ng`](https://hub.docker.com/r/swissmakers/wikijs-ng) |
| GitHub Container Registry | [`ghcr.io/swissmakers/wikijs-ng`](https://github.com/swissmakers/wikijs-ng/pkgs/container/wikijs-ng) |

Available tags: `latest`, `v<version>` (for example `v2.8.0`), and the commit SHA for fully reproducible deployments.

Quick start with PostgreSQL (Podman and Docker are interchangeable):

```bash
podman run -d --name wikijs-ng -p 3000:3000 \
  -e DB_TYPE=postgres \
  -e DB_HOST=db.example.com \
  -e DB_PORT=5432 \
  -e DB_USER=wikijs \
  -e DB_PASS=changeme \
  -e DB_NAME=wiki \
  ghcr.io/swissmakers/wikijs-ng:latest
```

Evaluation setup with SQLite (single container, persistent volume):

```bash
podman run -d --name wikijs-ng -p 3000:3000 \
  -e DB_TYPE=sqlite -e DB_FILEPATH=/wiki/data/db.sqlite \
  -v wikijs-data:/wiki/data \
  ghcr.io/swissmakers/wikijs-ng:latest
```

Open `http://localhost:3000` and complete the setup wizard. A compose example including PostgreSQL is provided in [`dev/examples/docker-compose.yml`](dev/examples/docker-compose.yml).

### Requirements

- A supported database: PostgreSQL 11+ (recommended), MySQL 8+, MariaDB 10.3+, SQLite 3.9+ or MS SQL Server 2012+
- For container deployments: Podman 4+ or Docker
- For source installations: Node.js 24 or later

## Building from source

```bash
yarn install
yarn build          # production client assets (yarn build:safe on memory-constrained hosts)
yarn test           # lint and unit tests
node server         # start Wiki.js NG
```

[`dev/BUILD.md`](dev/BUILD.md) covers memory-constrained hosts, native modules on older distributions, container image builds (including multi-arch) and throwaway test instances. CI runs the lint and unit tests for every push and pull request and builds the images from `main`.

## Upgrading from Wiki.js 2.5.314

Wiki.js NG is intended to be a direct replacement for Wiki.js. It uses the same database schema, configuration format and content storage. You can point the container at your existing database and data volumes. Review the [CHANGELOG](CHANGELOG.md) before upgrading, in particular the notes on the Git storage module and SAML configuration options.

## Running fully offline

Wiki.js NG does not depend on any upstream service. The interface translations
for English, German, French and Italian are bundled in `server/locales/`; there
is no download or sync of language packs anymore. Additional languages or
custom wording can be sideloaded as YAML files into `data/sideload/locales/`
(see [`server/locales/README.md`](server/locales/README.md)).

A few optional features use external services. Disable them or point them to
self-hosted instances if the wiki must not reach the internet:

| Feature | Default | Where to change it |
| --- | --- | --- |
| PlantUML diagrams | enabled, rendered by `https://www.plantuml.com/plantuml` | Admin → Rendering → PlantUML (server or disable) |
| Kroki diagrams | disabled (`https://kroki.io`) | Admin → Rendering → Kroki |
| draw.io diagram editor | `https://embed.diagrams.net` | Admin → General → Integrations |
| Font Awesome icons | only with the Font Awesome icon sets (CDN) | Admin → Theme → Icon set (`mdi` is bundled) |

Modules you configure yourself (authentication providers, storage targets,
search engines, analytics, comment providers, mail) connect only to the
services you enter.

## Security

Please report vulnerabilities responsibly through a [private security advisory](https://github.com/swissmakers/wikijs-ng/security/advisories/new). Do not open public issues for security problems. See [SECURITY.md](SECURITY.md) for the supported versions and full reporting guidelines.

## Support and sponsoring

- Issues and feature requests: [GitHub issue tracker](https://github.com/swissmakers/wikijs-ng/issues)
- Commercial support and consulting: [swissmakers.ch](https://swissmakers.ch)
- If Wiki.js NG is valuable to your organization, please consider [sponsoring the project on GitHub](https://github.com/sponsors/swissmakers) to support ongoing maintenance and security work.

## License and acknowledgements

Wiki.js NG is licensed under the [AGPL-3.0](LICENSE), the same license as the upstream project.

This project is a fork of [Wiki.js](https://github.com/requarks/wiki) by Nicolas Giard and contributors. We are grateful for the years of work that went into the upstream project; upstream fixes are reviewed and merged where applicable.
