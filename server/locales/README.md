# Locales

This folder contains the **bundled base locale files** for Wiki.js NG.

At startup (and whenever locales are reloaded), strings are loaded in this order:

1. **Bundled file** `{LANG}.yml` from this folder (base strings, always available — no internet access required)
2. **Database strings** (downloaded locale packs and admin-side overrides) — these take precedence over the bundled base

This means a fresh install renders a fully translated UI without any connection to the upstream localization service. The optional daily sync job (`sync-graph-locales`, gated by the *Update Automatically* toggle in Admin → Locale) can still pull newer strings into the database on top of the bundled base; failures are logged as warnings and never break the UI.

## File format

Top-level keys are i18next namespaces (`common`, `admin`, `auth`, `editor`, `history`, `profile`, `tags`), with nested keys below. e.g.:

```yml
admin:
  api:
    title: 'API Access'
common:
  header:
    search: 'Search...'
```

To test new keys live, add them to the corresponding `{LANG}.yml` file and restart Wiki.js. New UI code should also pass an inline `defaultValue` to `$t()` so it renders correctly even before the locale files are updated.
