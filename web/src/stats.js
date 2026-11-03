// Statistics for the /stats/ page, from the same files the list uses: processed.json (the past year, sorted by
// Claude into kinds of product) and history.json (ten years, titles only). Shared by the app (components/Stats.jsx)
// and the build's pre-rendered copy (scripts/prerender.mjs), so both say the same numbers.

export const REGIONS = ['europe', 'gb', 'us']
export const regionOf = (cc) => (cc === 'US' ? 'us' : cc === 'GB' ? 'gb' : 'europe')

// What makes a product dangerous, from the official notice's reason (in English). A recall can have several.
export const HAZARDS = [
  ['choking', /chok|small parts?|swallow|ingest/],
  ['chemical', /chemical|phthalate|\blead\b|cadmium|formaldehyde|boron|nickel|asbestos|nitrosamine|chromium|bisphenol|azo dye|substance|toxic|pfas|pfoa|irritant|alcohol/],
  ['injury', /injur|laceration|\bcuts?\b|\bfall|entrap|trapp|pinch|tip.?over|crush|sharp/],
  ['strangulation', /strangul|cord|drawstring/],
  ['suffocation', /suffocat|asphyxia/],
  ['fire', /fire|burn|flammab|overheat/],
  ['electric', /electric shock|electrocut/],
  ['magnets', /magnet|button batter|coin batter|battery/],
  ['germs', /salmonella|listeria|bacteri|microb|pathogen|mou?ld|cronobacter|e\. ?coli|germ/],
  ['allergen', /allergen|undeclared|gluten|peanut/],
  ['foreign', /foreign (bod|object|matter)|glass|metal (piece|fragment|part)|plastic (piece|fragment)/],
  ['drowning', /drown/],
]

const reasonEn = (r) => String(typeof r.reason === 'string' ? r.reason : (r.reason?.en || '')).toLowerCase()
export const hazardsOf = (r) => HAZARDS.filter(([, re]) => re.test(reasonEn(r))).map(([k]) => k)

const count = (items, key) => {
  const out = {}
  for (const x of items) for (const k of [].concat(key(x))) if (k) out[k] = (out[k] || 0) + 1
  return out
}
const ranked = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])

const day = (d) => d.toISOString().slice(0, 10)
const dateOf = (r) => String(r.publish_date || r.publish_datetime || r.date || '').slice(0, 10)

/** The time ranges on offer: rolling ones from the list, and whole years once the history is loaded. EU years
 *  count only once nearly all their weekly reports are read (src/history.py reads old ones a batch a day). */
export function ranges(history, now = new Date()) {
  const back = (days) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - days); return day(d) }
  const out = [
    { id: '30d', from: back(30), to: day(now) },
    { id: '3m', from: back(91), to: day(now) },
    { id: '12m', from: back(365), to: day(now) },
  ]
  if (history?.recalls?.length) {
    const done = count(history.reports_done || [], ref => ref.split('-')[1])
    const thisYear = now.getUTCFullYear()
    const first = Number(String(history.since).slice(0, 4)) + 1
    const complete = []
    for (let y = thisYear - 1; y >= first && (done[y] || 0) >= 45; y--) complete.push(y)
    if (complete.length >= 2) out.push({ id: 'all', from: `${complete[complete.length - 1]}-01-01`, to: day(now) })
    out.push({ id: String(thisYear), from: `${thisYear}-01-01`, to: day(now), year: thisYear })
    for (const y of complete) out.push({ id: String(y), from: `${y}-01-01`, to: `${y}-12-31`, year: y })
  }
  return out
}

// Bars over time: weeks for a short range, months up to about a year, years beyond.
function bins(from, to) {
  const span = (new Date(to) - new Date(from)) / 864e5
  const out = []
  if (span <= 100) {
    const d = new Date(`${from}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)) // the Monday of the first week
    for (; day(d) <= to; d.setUTCDate(d.getUTCDate() + 7)) {
      const end = new Date(d); end.setUTCDate(end.getUTCDate() + 6)
      out.push({ key: day(d), from: day(d), to: day(end), unit: 'week' })
    }
  } else if (span <= 400) {
    const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`)
    for (; day(d) <= to; d.setUTCMonth(d.getUTCMonth() + 1)) {
      const end = new Date(d); end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0)
      out.push({ key: day(d).slice(0, 7), from: day(d), to: day(end), unit: 'month' })
    }
  } else {
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push({ key: String(y), from: `${y}-01-01`, to: `${y}-12-31`, unit: 'year' })
  }
  return out
}

/** The numbers for one time range. `recalls` is the list (with reasons, kinds and reporting countries);
 *  `history` (ten years, titles only) may be null. */
export function computeStats(recalls, history, range) {
  const { from, to } = range
  const inRange = (r) => { const d = dateOf(r); return d >= from && d <= to }
  // The list has the details; the history adds older recalls (counted, but without reasons or kinds).
  const known = new Set(recalls.flatMap(r => [r.id, ...(r.also || []).map(a => a.id)]))
  const rich = recalls.filter(inRange)
  const old = (history?.recalls || []).filter(r => !known.has(r.id) && !(r.also || []).some(a => known.has(a.id)) && inRange(r))
  const all = [...rich.map(r => ({ date: dateOf(r), region: regionOf(r.country_sold_in), sources: [r.source, ...(r.also || []).map(a => a.source)] })),
    ...old.map(r => ({ date: dateOf(r), region: regionOf(r.country), sources: [r.source, ...(r.also || []).map(a => a.source)] }))]

  const listFrom = recalls.reduce((m, r) => (dateOf(r) && dateOf(r) < m ? dateOf(r) : m), '9999')
  const today = day(new Date())
  const time = bins(from, to).map(b => ({ ...b, n: all.filter(r => r.date >= b.from && r.date <= b.to).length, partial: b.to > today }))

  const sorted = rich.filter(r => r.category)
  const withHazard = rich.map(hazardsOf)
  const reporters = count(rich.filter(r => r.country_sold_in === 'EU'), r => r.location_sold_in || [])
  const ukFrom = (history?.recalls || []).filter(r => r.country === 'GB').reduce((m, r) => (r.date < m ? r.date : m), listFrom)

  return {
    range,
    total: all.length,
    regions: count(all, r => r.region),
    time,
    detailed: rich.length,
    detailsFrom: from < listFrom ? listFrom : null, // reasons and kinds only go back this far
    ukFrom: from < ukFrom.slice(0, 4) + '-01-01' ? ukFrom.slice(0, 4) : null,
    categories: ranked(count(sorted, r => r.category)),
    unsorted: rich.length - sorted.length,
    hazards: ranked(count(withHazard, h => h)),
    reporters: ranked(reporters).slice(0, 10),
    sources: ranked(count(all, r => r.sources.filter((x, i, a) => x && a.indexOf(x) === i))),
  }
}
