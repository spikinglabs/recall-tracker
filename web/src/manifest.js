// The web app manifest, one per language (written by scripts/prerender.mjs next to each language's home page),
// so the installed app opens in the language it was installed from. They share one id, so a phone never ends
// up with two copies of the app. Same pattern as Allo Outings.
import { translations } from './translations.js'
import { LANG_DIR, SITE, homePath, statsPath } from './paths.js'

export const manifestPath = (lang) => `${homePath(lang)}manifest.webmanifest`

export function manifest(lang) {
  const t = translations[lang] || translations.en
  const home = homePath(lang)
  return {
    id: '/',
    name: t.title,
    short_name: t.title,
    description: t.subtitle,
    lang: lang === 'zh-CN' ? 'zh-Hans' : lang,
    start_url: home,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f5f2',
    theme_color: '#ffcc00',
    categories: ['kids', 'lifestyle', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    // Lets the page ask Chrome whether the app is already installed (navigator.getInstalledRelatedApps).
    related_applications: Object.keys(LANG_DIR).map((l) => ({ platform: 'webapp', url: SITE + manifestPath(l) })),
    shortcuts: [
      { name: t.statsLink, url: statsPath(lang), icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
    // A listing shared from another app (Vinted, Kleinanzeigen …) opens the second-hand check with it.
    share_target: { action: home, method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
  }
}
