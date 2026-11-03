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

// The same kind of product in German, English, French and Spanish, so "Kinderwagen" finds a "pushchair" recall.
const KINDS = `
kinderwagen|buggy|pram|stroller|pushchair|poussette|carrito|cochecito
babyschale|autositz|autokindersitz|kindersitz|car seat|carseat|siege auto|silla de coche|isofix
hochstuhl|high chair|highchair|chaise haute|trona
schnuller|pacifier|dummy|soother|tetine|chupete
beissring|beißring|teether|teething|dentition|mordedor
laufstall|playpen|play pen|parc bebe|parque
reisebett|travel cot|travel bed|lit parapluie|cuna de viaje
babybett|kinderbett|beistellbett|stubenwagen|crib|cot|bassinet|co-sleeper|cuna|berceau|lit bebe
schlafsack|sleeping bag|sleepbag|sleep sack|gigoteuse|saco de dormir
babywippe|wippe|bouncer|transat|hamaca
babyschaukel|schaukel|swing|balancelle|columpio
lauflernhilfe|lauflernwagen|walker|trotteur|andador
helm|fahrradhelm|helmet|casque|casco
spielzeug|toy|jouet|juguete
puppe|doll|poupee|muneca
kuscheltier|plüschtier|plush|soft toy|teddy|peluche
trinklernbecher|sippy cup|tasse|vaso
babyflasche|flasche|bottle|biberon
babyfon|babyphone|baby monitor|ecoute bebe|vigilabebes
treppenschutzgitter|türschutzgitter|schutzgitter|safety gate|stair gate|barriere|barrera
fahrradsitz|bike seat|bicycle seat|child seat|siege velo
babytrage|trage|carrier|baby carrier|porte bebe|mochila portabebe
wickeltisch|wickelauflage|changing table|changing mat|table a langer|cambiador
badesitz|bath seat|bath ring|siege de bain|asiento de bano
anfangsnahrung|folgenahrung|milchnahrung|formula|lait infantile|leche de formula`
  .trim().split('\n').map(line => line.split('|').map(w => norm(w)))
const KIND_OF = new Map(KINDS.flatMap(group => group.map(w => [w, group])))

const codesOf = (r) => [...(r.codes || []), ...(r.also || []).flatMap(a => a.codes || [])]
const textOf = (r) => norm([
  r.title, r.en, r.title_i18n && Object.values(r.title_i18n).join(' '), r.company, codesOf(r).join(' '),
  ...(r.also || []).map(a => `${a.title} ${a.en || ''} ${a.company || ''}`),
  typeof r.reason === 'string' ? r.reason : r.reason && (r.reason.en || ''),
].filter(Boolean).join(' '))

// Each recall's text, three ways: as written, without spaces and hyphens ("maxi-cosi" -> "maxicosi"), and as words.
const prepared = new WeakMap()
const prepare = (r) => {
  let p = prepared.get(r)
  if (!p) {
    const text = textOf(r)
    const words = text.split(/[^a-z0-9äöüß]+/).filter(Boolean)
    p = { text, joined: words.join(''), spaced: ` ${words.join(' ')} `, words: words.filter(w => w.length >= 4) }
    prepared.set(r, p)
  }
  return p
}

// One letter added, dropped or changed ("cybx" ~ "cybex").
const oneOff = (a, b) => {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

const has = (p, w, typos = true) => {
  if (p.text.includes(w) || p.joined.includes(w)) return true
  const kind = KIND_OF.get(w)
  // Whole words only, so "cot" isn't found in "cotton"; a plural counts.
  if (kind && kind.some(k => p.spaced.includes(` ${k} `) || p.spaced.includes(` ${k}s `))) return true
  return typos && w.length >= 6 && !/\d/.test(w) && p.words.some(x => oneOff(w, x))
}

/** How well a recall matches: 0 = not at all. Up to three words must all be there (so "Maxi-Cosi Pebble" doesn't
 *  match another Maxi-Cosi product); a longer pasted title needs three in four of its words. Spelling ("Maxicosi"),
 *  one typo in a word of six letters or more (when no recall has the word as typed), and the kind of product in another language ("Kinderwagen" ~ "pushchair") count. */
export function score(recall, q, exact = new Set()) {
  if (q.barcode) {
    return codesOf(recall).some(c => c.replace(/^0+/, '') === q.barcode) ? 100 : 0
  }
  if (!q.words.length) return 1
  const p = prepare(recall)
  const hits = q.words.filter(w => has(p, w, !exact.has(w))).length
  const need = q.words.length <= 3 ? q.words.length : Math.ceil(q.words.length * 0.75)
  return hits >= need ? hits : 0
}

/** Recalls that match, best first (date breaks ties). */
export function search(recalls, q) {
  // A word that some recall has as written is taken as written: "cybex" shouldn't also find "cyber".
  const exact = new Set(q.words.filter(w => recalls.some(r => has(prepare(r), w, false))))
  return recalls
    .map(r => [r, score(r, q, exact)])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || String(b[0].publish_date || b[0].date).localeCompare(String(a[0].publish_date || a[0].date)))
    .map(([r]) => r)
}
