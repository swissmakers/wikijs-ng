/* global PRISM_LANGUAGES */
import Prism from 'prismjs'

// Fence names used in pages that Prism knows under another name
const ALIASES = {
  apache: 'apacheconf',
  apache2: 'apacheconf',
  htaccess: 'apacheconf',
  ps1: 'powershell',
  pwsh: 'powershell',
  console: 'shell-session',
  aspx: 'aspnet'
}

// Language ids and aliases that exist in prismjs/components (injected by webpack)
const AVAILABLE = new Set(PRISM_LANGUAGES)

/**
 * Highlight the code blocks inside a container.
 *
 * The autoloader requests /_assets/js/prism/prism-<name>.js for every language it does
 * not know yet — for a fence name Prism has no grammar for (`apache`, `conf`, `rsc`, or
 * the plaincommand / plainpowershell / logs styles) that is a 404 and a console error.
 * Known alternative names are mapped to their grammar; any other unknown name is
 * rendered as plain text. Its class stays, so the CSS styles for those blocks apply.
 */
export function highlightCode (container) {
  for (const el of container.querySelectorAll('code[class*="lang"]')) {
    const match = el.className.match(/\blang(?:uage)?-([\w-]+)\b/i)
    if (!match) {
      continue
    }
    const lang = match[1].toLowerCase()
    if (ALIASES[lang]) {
      el.classList.remove(match[0])
      el.classList.add(`language-${ALIASES[lang]}`)
    } else if (!(lang in Prism.languages) && !AVAILABLE.has(lang)) {
      Prism.languages[lang] = Prism.languages.plain
    }
  }
  Prism.highlightAllUnder(container)
}
