# Locales

This folder contains the **bundled locale files** of Wiki.js NG: English (`en.yml`), German (`de.yml`), French (`fr.yml`) and Italian (`it.yml`). They are listed in `locales.yml` together with their display names and text direction.

Wiki.js NG never downloads language packs. All strings are loaded at startup in this order:

1. **Bundled file** `server/locales/<code>.yml` (always available, no internet access required)
2. **Database strings**, only for languages that are *not* bundled: packs downloaded by older versions keep working
3. **Sideloaded file** `<dataPath>/sideload/locales/<code>.yml`, merged on top (custom languages or wording overrides)

English is always loaded as the fallback for missing keys.

## File format

Top-level keys are i18next namespaces (`admin`, `auth`, `common`, `editor`, `history`, `profile`, `tags`), with nested keys below:

```yml
admin:
  api:
    title: 'API Access'
common:
  header:
    search: 'Search...'
```

All four bundled files must contain exactly the same keys. New UI code should also pass an inline `defaultValue` to `$t()`.

## Sideloading

To add a language or override single strings without rebuilding the image, create `<dataPath>/sideload/locales/` (default `data/sideload/locales/`):

- `<code>.yml`: strings in the format above. For a bundled language only the keys you want to override are needed.
- `locales.yml`: required for languages that are not bundled, same format as the bundled manifest:

```yml
- code: es
  name: Spanish
  nativeName: Español
  isRTL: false
```

Restart Wiki.js afterwards. Sideloaded languages then appear in **Administration → Locale**.
