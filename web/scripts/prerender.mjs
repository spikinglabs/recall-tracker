// After `vite build`: one HTML page per language and per recall, so search engines and link previews see real
// titles, descriptions and text. The app (src/main.jsx) replaces the plain copy in #app when it starts.
// Also writes sitemap.xml, robots.txt and 404.html (the app itself, for codes newer than the last build).
//
// The list comes from the published data, so the pages are as fresh as the last build; the deploy workflow
// runs again after each daily scrape. Without the data (offline) it writes the language pages only.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { translations } from '../src/translations.js'
import { companyName, getLocal, regionName, shortId } from '../src/share.js'
import { LANG_DIR, SITE, homePath, recallPath, statsPath } from '../src/paths.js'
import { computeStats, ranges, REGIONS } from '../src/stats.js'
import { alloSites } from '../src/allo.js'
import { manifest, manifestPath } from '../src/manifest.js'

const PAGE = 24

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const DATA = [
  'https://recalls-api.allo.land/baby/scraped_date%3Dlatest/',
  'https://pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev/baby/scraped_date%3Dlatest/',
]
const LANGS = Object.keys(LANG_DIR)
const HREFLANG = { en: 'en', de: 'de', es: 'es', fr: 'fr', 'zh-CN': 'zh-Hans' }
const OG_LOCALE = { en: 'en_GB', de: 'de_DE', es: 'es_ES', fr: 'fr_FR', 'zh-CN': 'zh_CN' }

async function fetchJson(name) {
  for (const base of DATA) {
    try {
      const r = await fetch(base + name)
      if (r.ok) return await r.json()
    } catch { /* try the next address */ }
  }
  return null
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s)
const plain = (s) => String(s).replace(/\[|\]/g, '')
// JSON inside <script>: "</" must not end the script early.
const ld = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

// The other Allo sites, on every page.
const family = (lang) => `<footer class="family"><h2>${esc(translations[lang].moreAllo)}</h2><ul>` +
  alloSites(lang).map(x => `<li><a href="${x.url}"><b>${esc(x.name)}</b> <span>${esc(translations[lang].allo[x.id])}</span></a></li>`).join('') + '</ul></footer>'

function page(template, { lang, path, title, description, alternates, body, jsonld, type = 'website', published }) {
  const url = SITE + path
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...alternates.map(([l, p]) => `<link rel="alternate" hreflang="${HREFLANG[l]}" href="${SITE + p}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE + alternates.find(([l]) => l === 'en')[1]}" />`,
    `<meta property="og:site_name" content="${esc(translations[lang].title)}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    published ? `<meta property="article:published_time" content="${published}" />` : '',
    `<script type="application/ld+json">${ld(jsonld)}</script>`,
  ].filter(Boolean).join('\n    ')
  return template
    .replace(/<html lang="[^"]*">/, `<html lang="${HREFLANG[lang]}">`)
    .replace(/<title>.*?<\/title>/s, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<link rel="manifest" href="[^"]*"/, `<link rel="manifest" href="${manifestPath(lang)}"`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app">${body}${family(lang)}</div>`)
}

function card(r, t, lang, link) {
  const title = getLocal(r.title_i18n, lang) || r.title
  const reason = getLocal(r.reason, lang)
  const who = [companyName(r.company), r.country_sold_in && regionName(r.country_sold_in, lang)].filter(Boolean).join(' · ')
  const h = link ? `<a href="${recallPath(lang, shortId(r.id))}">${esc(title)}</a>` : esc(title)
  return `<article class="item"><div class="item-body"><h${link ? 3 : 1}>${h}</h${link ? 3 : 1}>` +
    (title !== r.title ? `<p class="orig">${esc(r.title)}</p>` : '') +
    `<div class="meta">${esc(who)} · <time datetime="${esc(r.publish_date)}">${esc(r.publish_date)}</time></div>` +
    (reason ? `<p class="reason">${esc(reason)}</p>` : '') +
    `<div class="trust"><a href="${esc(r.url)}" rel="nofollow noopener">${esc(t.officialNotice)}</a> · ${esc(r.source)}</div></div></article>`
}

const template = await readFile(join(DIST, 'index.html'), 'utf8')
const recalls = ((await fetchJson('processed.json')) || [])
  .sort((a, b) => String(b.publish_date).localeCompare(String(a.publish_date)))
const status = await fetchJson('status.json')
const historyData = await fetchJson('history.json')
const stats = computeStats(recalls, historyData, ranges(historyData).find(r => r.id === '12m'))
const lastmod = (status?.updated || new Date().toISOString()).slice(0, 10)
const urls = []

async function write(path, html) {
  const file = join(DIST, path, 'index.html')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, html)
}

// The app as it is, for addresses the build doesn't know (GitHub Pages serves 404.html for them).
await writeFile(join(DIST, '404.html'), template)

for (const lang of LANGS) {
  const t = translations[lang]
  await mkdir(join(DIST, homePath(lang)), { recursive: true })
  await writeFile(join(DIST, manifestPath(lang)), JSON.stringify(manifest(lang), null, 1))
  const path = homePath(lang)
  const title = `${t.title} · ${plain(t.hero)}`
  const description = `${t.subtitle} ${recalls.length ? t.count.replace('{n}', recalls.length) + '.' : ''}`.trim()
  const body = `<main class="app"><section class="ask"><h1>${esc(plain(t.hero))}</h1><p class="sub">${esc(t.subtitle)}</p></section>` +
    `<section class="section"><h2>${esc(t.count.replace('{n}', recalls.length))}</h2><div class="grid">` +
    // The newest ones only; each recall has its own page, listed in the sitemap.
    recalls.slice(0, PAGE).map((r) => card(r, t, lang, true)).join('') + `</div></section></main>`
  await write(path, page(template, {
    lang, path, title, description, body,
    alternates: LANGS.map((l) => [l, homePath(l)]),
    jsonld: {
      '@context': 'https://schema.org', '@type': 'WebSite', name: t.title, url: SITE + path, inLanguage: HREFLANG[lang], description: t.subtitle,
      potentialAction: { '@type': 'SearchAction', target: `${SITE + path}?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  }))
  urls.push([path, lastmod, LANGS.map((l) => [l, homePath(l)])])

  // The statistics page, as plain lists (the app draws the charts).
  {
    const p = statsPath(lang)
    const list = (rows, label) => `<ul>${rows.map(([k, n]) => `<li>${esc(label(k))}: ${n}</li>`).join('')}</ul>`
    const regions = REGIONS.map(r => `${t.statsRegions[r]} ${stats.regions[r] || 0}`).join(', ')
    const body = `<main class="app"><p><a href="${path}">${esc(t.title)}</a></p><section class="ask"><h1>${esc(t.statsTitle)}</h1><p class="sub">${esc(t.statsIntro)}</p></section>` +
      `<p><b>${stats.total}</b> ${esc(t.statsTotal)} (${esc(regions)})</p>` +
      `<h2>${esc(t.statsPerMonth)}</h2>${list(stats.time.map(b => [b.key, b.n]), (m) => m)}` +
      `<h2>${esc(t.statsHazards)}</h2>${list(stats.hazards, (k) => t.hazards[k] || k)}` +
      (stats.categories.length ? `<h2>${esc(t.statsKinds)}</h2>${list(stats.categories, (k) => t.categories[k] || k)}` : '') +
      (stats.reporters.length ? `<h2>${esc(t.statsReporters)}</h2>${list(stats.reporters, (k) => regionName(k, lang))}` : '') +
      `</main>`
    await write(p, page(template, {
      lang, path: p, body,
      title: `${t.statsTitle} · ${t.title}`,
      description: cut(`${stats.total} ${t.statsTotal} (${regions}). ${t.statsIntro}`, 160),
      alternates: LANGS.map((l) => [l, statsPath(l)]),
      jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: t.statsTitle, url: SITE + p, inLanguage: HREFLANG[lang], description: t.statsIntro },
    }))
    urls.push([p, lastmod, LANGS.map((l) => [l, statsPath(l)])])
  }

  for (const r of recalls) {
    const code = shortId(r.id)
    const p = recallPath(lang, code)
    const name = getLocal(r.title_i18n, lang) || r.title
    const reason = getLocal(r.reason, lang)
    const who = [companyName(r.company), r.country_sold_in && regionName(r.country_sold_in, lang)].filter(Boolean).join(' · ')
    await write(p, page(template, {
      lang, path: p, type: 'article', published: r.publish_date,
      title: `${t.recallTag}: ${name} · ${t.title}`,
      description: cut([reason, who].filter(Boolean).join(' · ') || name, 160),
      body: `<main class="app"><p><a href="${path}">${esc(t.title)}</a></p>${card(r, t, lang, false)}</main>`,
      alternates: LANGS.map((l) => [l, recallPath(l, code)]),
      jsonld: {
        '@context': 'https://schema.org', '@type': 'NewsArticle', headline: cut(`${t.recallTag}: ${name}`, 110),
        description: reason || undefined, datePublished: r.publish_date, inLanguage: HREFLANG[lang], url: SITE + p,
        image: [`${SITE}/og.png`], isBasedOn: r.url,
        about: { '@type': 'Product', name: r.title, brand: companyName(r.company) || undefined },
        publisher: { '@type': 'Organization', name: t.title, url: SITE + path },
      },
    }))
    urls.push([p, String(r.last_seen || r.publish_date).slice(0, 10), LANGS.map((l) => [l, recallPath(l, code)])])
  }
}

await writeFile(join(DIST, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...urls.map(([p, mod, alts]) => `<url><loc>${SITE + p}</loc><lastmod>${mod}</lastmod>${alts.map(([l, a]) => `<xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${SITE + a}"/>`).join('')}</url>`),
  '</urlset>',
].join('\n'))
await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
console.log(`Pre-rendered ${urls.length} pages (${recalls.length} recalls × ${LANGS.length} languages + home pages).`)
