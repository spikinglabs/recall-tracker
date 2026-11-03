// The site's addresses, shared by the app and the build's pre-rendering (scripts/prerender.mjs):
// English at the root, the other languages under /de/, /es/, /fr/ and /zh/, and one page per recall at
// <language>/r/<code>/ (the six-character code from share.js), so search engines and link previews see it.
export const SITE = 'https://recalls.allo.land'
export const LANG_DIR = { en: '', de: 'de', es: 'es', fr: 'fr', 'zh-CN': 'zh' }
const DIR_LANG = Object.fromEntries(Object.entries(LANG_DIR).filter(([, d]) => d).map(([l, d]) => [d, l]))

export const homePath = (lang) => (LANG_DIR[lang] ? `/${LANG_DIR[lang]}/` : '/')
export const recallPath = (lang, code) => `${homePath(lang)}r/${code}/`

/** The language a path names (null at the root, where the reader's choice applies) and the recall code in it. */
export function parsePath(pathname) {
  const m = pathname.match(/^\/(?:(de|es|fr|zh)(?:\/|$))?(?:r\/([2-9A-HJKMNP-Z]{6})\/?)?/i)
  return { lang: m?.[1] ? DIR_LANG[m[1].toLowerCase()] : null, code: m?.[2] ? m[2].toUpperCase() : null }
}
