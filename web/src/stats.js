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

/** The numbers for the page. `now` is a Date; `history` may be null (not built or not loaded yet). */
export function computeStats(recalls, history, now = new Date()) {
  const yearAgo = new Date(now)
  yearAgo.setUTCFullYear(now.getUTCFullYear() - 1)
  const dateOf = (r) => String(r.publish_date || r.publish_datetime || r.date || '').slice(0, 10)
  const year = recalls.filter(r => dateOf(r) >= yearAgo.toISOString().slice(0, 10))

  // The last twelve whole months, oldest first, as "2026-03" (the month under way would look like a drop).
  const months = []
  for (let i = 12; i >= 1; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  const perMonth = count(year, r => dateOf(r).slice(0, 7))

  const sorted = year.filter(r => r.category)
  const withHazard = year.map(hazardsOf)

  // EU countries that reported the alerts (Safety Gate names the reporting country).
  const reporters = count(year.filter(r => r.country_sold_in === 'EU'), r => r.location_sold_in || [])

  const out = {
    total: year.length,
    regions: count(year, r => regionOf(r.country_sold_in)),
    months: months.map(m => [m, perMonth[m] || 0]),
    categories: ranked(count(sorted, r => r.category)),
    unsorted: year.length - sorted.length,
    hazards: ranked(count(withHazard, h => h)),
    hazardKnown: withHazard.filter(h => h.length).length,
    reporters: ranked(reporters).slice(0, 10),
    sources: ranked(count(year, r => [r.source, ...(r.also || []).map(a => a.source)].filter((s, i, a) => a.indexOf(s) === i))),
    years: null,
  }

  // Ten years by region. Old EU weeks are read a batch per day (src/history.py), so a year counts for Europe
  // only once nearly all its weekly reports are in.
  if (history?.recalls?.length) {
    const done = count(history.reports_done || [], ref => ref.split('-')[1])
    const first = Number(String(history.since).slice(0, 4)) + 1 // the first year is only partly inside ten years
    const last = now.getUTCFullYear()
    const byYear = {}
    for (const r of history.recalls) {
      const y = Number(String(r.date).slice(0, 4))
      if (y < first || y > last) continue
      const reg = regionOf(r.country)
      ;(byYear[y] ||= { europe: 0, gb: 0, us: 0 })[reg]++
    }
    out.years = []
    for (let y = first; y <= last; y++) {
      const row = byYear[y] || { europe: 0, gb: 0, us: 0 }
      const complete = y === last || (done[y] || 0) >= 45
      out.years.push({ year: y, europe: complete ? row.europe : null, gb: row.gb, us: row.us })
    }
    // The UK list starts in 2021 or so; years before that have no UK data rather than zero recalls.
    const ukFrom = out.years.find(r => r.gb > 0)?.year
    for (const r of out.years) if (ukFrom && r.year < ukFrom) r.gb = null
  }
  return out
}
