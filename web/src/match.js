// Search that works for a product in hand or a second-hand listing: a barcode, a model number, a brand, a
// listing's title with extra words ("Cybex Solution Z-Fix Kindersitz top Zustand"), or a listing's link
// (vinted.de/items/123-cybex-solution-z-fix, kleinanzeigen.de/s-anzeige/cybex-solution-z-fix/123-…).

// Words in listings that don't name the product.
const FILLER = new Set(`
a an and the for with in of on to by used new like very good top condition boy girl kids kid baby babies child children
und mit der die das für von im in neu neuwertig gebraucht wie sehr gut guter zustand top kaum kinder kind baby babys junge mädchen
inkl inklusive original ovp farbe grau schwarz weiss weiß blau rot rosa grün beige set kg cm stück abholung versand
de la le les et pour avec y el los con para nuevo usado
items item anzeige s-anzeige html www com de fr es uk`.split(/\s+/).filter(Boolean))

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')

/** The words to look for, from what was typed or pasted. */
export function parseQuery(raw) {
  let text = String(raw || '').trim()
  // A link, alone or in a shared text ("Schau dir das an: https://…"): the words are in its path
  // ("/items/4851234-cybex-solution-z-fix-kindersitz").
  const link = text.match(/https?:\/\/\S+/i)
  if (link) {
    try {
      const u = new URL(link[0])
      text = decodeURIComponent(u.pathname).replace(/\.html?$/, '').replace(/[\/_-]+/g, ' ')
    } catch { /* not a link after all */ }
  }
  const digits = text.replace(/[\s-]/g, '')
  if (/^\d{8,14}$/.test(digits)) return { barcode: digits.replace(/^0+/, ''), words: [], text }
  const words = norm(text).split(/[^a-z0-9äöüß]+/i)
    .filter(w => w && !FILLER.has(w) && !(/^\d+$/.test(w) && w.length > 6)) // listing ids
  return { barcode: null, words: [...new Set(words)], text: text.trim() }
}

const codesOf = (r) => [...(r.codes || []), ...(r.also || []).flatMap(a => a.codes || [])]
const haystack = (r) => norm([
  r.title, r.en, r.title_i18n && Object.values(r.title_i18n).join(' '), r.company, codesOf(r).join(' '),
  ...(r.also || []).map(a => `${a.title} ${a.en || ''} ${a.company || ''}`),
  typeof r.reason === 'string' ? r.reason : r.reason && (r.reason.en || ''),
].filter(Boolean).join(' '))

/** How well a recall matches: 0 = not at all. Up to three words must all be there (so "Maxi-Cosi Pebble" doesn't
 *  match another Maxi-Cosi product); a longer pasted title needs three in four of its words. */
export function score(recall, q) {
  if (q.barcode) {
    return codesOf(recall).some(c => c.replace(/^0+/, '') === q.barcode) ? 100 : 0
  }
  if (!q.words.length) return 1
  const hay = haystack(recall)
  const hits = q.words.filter(w => hay.includes(w)).length
  const need = q.words.length <= 3 ? q.words.length : Math.ceil(q.words.length * 0.75)
  return hits >= need ? hits : 0
}

/** Recalls that match, best first (date breaks ties). */
export function search(recalls, q) {
  return recalls
    .map(r => [r, score(r, q)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || String(b[0].publish_date || b[0].date).localeCompare(String(a[0].publish_date || a[0].date)))
    .map(([r]) => r)
}
