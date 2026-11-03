// Statistics as 1080×1440 posters, in the style of a recall's poster (share.js): one chart per picture, with the
// time range, the one-line takeaway, and where to find the site (no link, so it can go on Rednote too).
import { BODY, C, DISPLAY, SEARCH_ZH, SIGN, clamp, regionName, roundRect, wrap } from './share'
import { REGIONS } from './stats.js'
import { statsPath } from './paths.js'

const fmt = (d, lang, o) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang, { timeZone: 'UTC', ...o })

/** "12 months", "2025", "Since 2019". */
export function rangeLabel(range, t) {
  if (range.year) return String(range.year)
  return (t.ranges[range.id] || range.id).replace('{year}', range.from.slice(0, 4))
}

/** "4 Nov 2025 – 3 Nov 2026" */
export const periodText = (range, lang) =>
  `${fmt(range.from, lang, { day: 'numeric', month: 'short', year: 'numeric' })} – ${fmt(range.to, lang, { day: 'numeric', month: 'short', year: 'numeric' })}`

/** A bar's name under a chart ("Mar", "6.10.", "2024") and in full ("March 2026"). */
export function binName(b, lang, long = false) {
  if (b.unit === 'year') return b.key
  if (b.unit === 'month') return fmt(b.from, lang, long ? { month: 'long', year: 'numeric' } : { month: 'short' })
  return fmt(b.from, lang, long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'numeric' })
}

const pct = (n, total, lang) => `${Math.round((100 * n) / Math.max(1, total)).toLocaleString(lang)}%`

/** The one sentence each chart says, for the page and the poster. */
export function takeaway(kind, s, t, lang) {
  if (kind === 'overview') {
    return REGIONS.map(r => `${t.statsRegions[r]} ${(s.regions[r] || 0).toLocaleString(lang)}`).join(' · ')
  }
  if (kind === 'time') {
    const top = s.time.filter(b => !b.partial).reduce((m, b) => (!m || b.n > m.n ? b : m), null) || s.time[0]
    if (!top || !top.n) return ''
    const when = top.unit === 'week' ? t.statsWeekOf.replace('{date}', binName(top, lang, true)) : binName(top, lang, true)
    return t.statsBusiest.replace('{when}', when).replace('{n}', top.n.toLocaleString(lang))
  }
  if (kind === 'hazards' && s.hazards[0]) {
    const [k, n] = s.hazards[0]
    return t.statsTopHazard.replace('{hazard}', t.hazards[k] || k).replace('{pct}', pct(n, s.detailed, lang))
  }
  if (kind === 'kinds' && s.categories[0]) {
    const [k, n] = s.categories[0]
    return t.statsTopKind.replace('{kind}', t.categories[k] || k).replace('{pct}', pct(n, s.detailed - s.unsorted, lang))
  }
  if (kind === 'reporters' && s.reporters[0]) {
    const [k, n] = s.reporters[0]
    return t.statsTopReporter.replace('{country}', regionName(k, lang)).replace('{n}', n.toLocaleString(lang))
  }
  return ''
}

export function chartTitle(kind, s, t) {
  return {
    overview: t.statsTitle,
    time: { week: t.statsPerWeek, month: t.statsPerMonth, year: t.statsPerYear }[s.time[0]?.unit] || t.statsPerMonth,
    hazards: t.statsHazards,
    kinds: t.statsKinds,
    reporters: t.statsReporters,
  }[kind]
}

/** The text that goes with a statistics poster: with the link, or for Rednote without one. */
export function statsShareText(kind, s, t, lang, xhs = false) {
  const head = `📊 ${chartTitle(kind, s, t)} · ${rangeLabel(s.range, t)}`
  const say = takeaway(kind, s, t, lang)
  if (!xhs) return [head, say, t.statsShareTitle, location.origin + statsPath(lang)].filter(Boolean).join('\n')
  return [
    head, say, '',
    '数据来自官方召回通告（欧盟 Safety Gate、英国 OPSS、美国 CPSC 和 FDA、德国 Lebensmittelwarnung），重复通报只计一次。',
    `浏览器搜索「${SEARCH_ZH}」，查看全部召回和统计。`, '',
    ['德国带娃', '欧洲带娃', '母婴好物避雷', '召回', '宝宝用品', '德国妈妈'].map(x => `#${x}`).join(' '),
  ].join('\n')
}

// ---------- drawing ----------

function brand(ctx, t, X, y) {
  ctx.fillStyle = C.gold
  roundRect(ctx, X, y, 72, 72, 16); ctx.fill()
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3
  roundRect(ctx, X + 5, y + 5, 62, 62, 12); ctx.stroke()
  ctx.save(); ctx.translate(X + 12, y + 12); ctx.scale(2, 2)
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.stroke(new Path2D('M12 3.5 2.8 19.5h18.4z')); ctx.stroke(new Path2D('M12 10v4.5')); ctx.stroke(new Path2D('M12 17.2h.01'))
  ctx.restore()
  ctx.fillStyle = C.ink
  ctx.font = `800 44px ${DISPLAY}`
  ctx.textBaseline = 'middle'
  ctx.fillText(t.title, X + 96, y + 38)
  ctx.textBaseline = 'alphabetic'
}

function fit(ctx, text, weight, max, min, family, width) {
  let size = max
  for (; size > min; size -= 2) { ctx.font = `${weight} ${size}px ${family}`; if (ctx.measureText(text).width <= width) break }
  return size
}

/** Horizontal bars, the label above each bar and the number at its end. */
function bars(ctx, rows, label, total, lang, X, W, y, bottom) {
  // As many rows as fit at a readable size, at most eight.
  rows = rows.slice(0, Math.max(1, Math.min(8, Math.floor((bottom - y) / 94))))
  const max = Math.max(1, ...rows.map(([, n]) => n))
  const rowH = Math.min(118, (bottom - y) / Math.max(1, rows.length))
  for (const [i, [k, n]] of rows.entries()) {
    const top = y + i * rowH
    ctx.fillStyle = C.ink
    ctx.font = `${i === 0 ? 700 : 400} 38px ${BODY}`
    const value = total ? `${n.toLocaleString(lang)} · ${pct(n, total, lang)}` : n.toLocaleString(lang)
    ctx.textAlign = 'right'
    ctx.font = `700 38px ${SIGN}`
    const vw = ctx.measureText(value).width
    ctx.fillText(value, X + W, top + 40)
    ctx.textAlign = 'start'
    ctx.font = `${i === 0 ? 700 : 400} 38px ${BODY}`
    ctx.fillText(clamp(ctx, [label(k)], 1, W - vw - 30)[0], X, top + 40)
    ctx.fillStyle = C.line
    roundRect(ctx, X, top + 58, W, 24, 12); ctx.fill()
    ctx.fillStyle = i === 0 ? C.rot : C.blau
    roundRect(ctx, X, top + 58, Math.max(24, (W * n) / max), 24, 12); ctx.fill()
  }
}

/** Columns over time, the number on top of each. */
function columns(ctx, time, lang, X, W, y, bottom) {
  const max = Math.max(1, ...time.map(b => b.n))
  const gap = time.length > 10 ? 10 : 18
  const cw = (W - gap * (time.length - 1)) / time.length
  const base = bottom - 56
  const h = base - y - 56
  const top = time.reduce((m, b) => (!b.partial && b.n > m ? b.n : m), 0)
  for (const [i, b] of time.entries()) {
    const x = X + i * (cw + gap)
    const bh = Math.max(6, (h * b.n) / max)
    ctx.fillStyle = b.partial ? 'rgba(29, 79, 145, .4)' : b.n === top ? C.rot : C.blau
    roundRect(ctx, x, base - bh, cw, bh, Math.min(12, cw / 3)); ctx.fill()
    ctx.fillStyle = C.ink
    ctx.textAlign = 'center'
    ctx.font = `700 ${fit(ctx, String(b.n), 700, 34, 18, SIGN, cw + gap)}px ${SIGN}`
    ctx.fillText(b.n.toLocaleString(lang), x + cw / 2, base - bh - 14)
    ctx.fillStyle = C.soft
    const name = binName(b, lang)
    ctx.font = `400 ${fit(ctx, name, 400, 30, 16, BODY, cw + gap - 2)}px ${BODY}`
    ctx.fillText(name, x + cw / 2, base + 42)
    ctx.textAlign = 'start'
  }
  ctx.fillStyle = C.ink
  ctx.fillRect(X, base, W, 3)
}

function overview(ctx, s, t, lang, X, W, y, bottom) {
  ctx.fillStyle = C.ink
  const big = s.total.toLocaleString(lang)
  ctx.font = `800 ${fit(ctx, big, 800, 190, 110, DISPLAY, W)}px ${DISPLAY}`
  ctx.fillText(big, X - 6, y + 140)
  ctx.font = `700 46px ${BODY}`
  ctx.fillText(t.statsTotal, X, y + 222)
  // The three regions as tiles.
  const ty = y + 262, tw = (W - 40) / 3, th = 150
  for (const [i, r] of REGIONS.entries()) {
    const x = X + i * (tw + 20)
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, ty, tw, th, 22); ctx.fill()
    ctx.strokeStyle = C.line; ctx.lineWidth = 2
    roundRect(ctx, x, ty, tw, th, 22); ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.font = `800 72px ${DISPLAY}`
    ctx.fillText((s.regions[r] || 0).toLocaleString(lang), x + 26, ty + 82)
    ctx.fillStyle = C.soft
    ctx.font = `400 34px ${BODY}`
    ctx.fillText(t.statsRegions[r], x + 26, ty + 126)
  }
  // The three most common dangers underneath.
  if (s.hazards.length) {
    const hy = ty + th + 76
    ctx.fillStyle = C.ink
    ctx.font = `700 40px ${BODY}`
    ctx.fillText(t.statsHazards, X, hy)
    bars(ctx, s.hazards.slice(0, 3), k => t.hazards[k] || k, s.detailed, lang, X, W, hy + 30, bottom)
  }
}

/** One chart as a 1080×1440 PNG. kind: overview, time, hazards, kinds or reporters. */
export async function statsPosterPng(kind, s, t, lang) {
  await Promise.all(["400 40px 'Atkinson Hyperlegible'", "700 40px 'Atkinson Hyperlegible'", "700 40px 'Barlow Semi Condensed'", "800 40px 'Bricolage Grotesque Variable'"]
    .map(f => document.fonts?.load(f).catch(() => undefined)))
  const w = 1080, h = 1440
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const ctx = cv.getContext('2d')
  const X = 84, W = w - 2 * X

  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, w, h)
  ;['#000000', '#dd0000', '#ffce00'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 6, w, 6) })
  brand(ctx, t, X, 84)

  // The time range on a gold sign, top right.
  const label = rangeLabel(s.range, t).toUpperCase()
  ctx.font = `700 40px ${SIGN}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'
  const lw = ctx.measureText(label).width + 56
  ctx.fillStyle = C.gold
  roundRect(ctx, w - X - lw, 86, lw, 68, 16); ctx.fill()
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3
  roundRect(ctx, w - X - lw + 5, 91, lw - 10, 58, 12); ctx.stroke()
  ctx.fillStyle = C.ink
  ctx.textAlign = 'center'
  ctx.fillText(label, w - X - lw / 2, 134)
  ctx.textAlign = 'start'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  // Title, period, and the takeaway.
  let y = 270
  const title = kind === 'overview' ? t.statsTitle : chartTitle(kind, s, t)
  ctx.font = `800 76px ${DISPLAY}`
  ctx.fillStyle = C.ink
  for (const l of clamp(ctx, wrap(ctx, title, W), 2, W)) { ctx.fillText(l, X, y); y += 84 }
  ctx.font = `400 34px ${BODY}`
  ctx.fillStyle = C.soft
  ctx.fillText(periodText(s.range, lang), X, y + 4)
  y += 50
  const say = kind === 'overview' ? '' : takeaway(kind, s, t, lang)
  if (say) {
    ctx.font = `700 42px ${BODY}`
    const lines = clamp(ctx, wrap(ctx, say, W - 56), 3, W - 56)
    const bh = lines.length * 56 + 44
    ctx.fillStyle = '#fff4c2'
    roundRect(ctx, X, y, W, bh, 22); ctx.fill()
    ctx.fillStyle = C.ink
    lines.forEach((l, i) => ctx.fillText(l, X + 28, y + 64 + i * 56))
    y += bh
  }
  y += 50

  const foot = h - 170
  if (kind === 'overview') overview(ctx, s, t, lang, X, W, y, foot - 40)
  else if (kind === 'time') columns(ctx, s.time, lang, X, W, y, foot - 30)
  else if (kind === 'hazards') bars(ctx, s.hazards, k => t.hazards[k] || k, s.detailed, lang, X, W, y, foot - 40)
  else if (kind === 'kinds') bars(ctx, s.categories, k => t.categories[k] || k, s.detailed - s.unsorted, lang, X, W, y, foot - 40)
  else if (kind === 'reporters') bars(ctx, s.reporters, k => regionName(k, lang), 0, lang, X, W, y, foot - 40)

  // Foot: where to find it (no link), and the sources.
  ctx.fillStyle = C.ink
  ctx.fillRect(X, foot, W, 3)
  ctx.font = `700 ${fit(ctx, t.statsPosterFoot, 700, 36, 24, BODY, W)}px ${BODY}`
  ctx.fillText(clamp(ctx, wrap(ctx, t.statsPosterFoot, W), 1, W)[0], X, foot + 62)
  ctx.font = `400 26px ${BODY}`
  ctx.fillStyle = C.soft
  const src = s.sources.map(([k]) => k).join(' · ')
  ctx.fillText(clamp(ctx, wrap(ctx, src, W), 1, W)[0], X, foot + 108)

  return new Promise((ok, fail) => cv.toBlob(b => (b ? ok(b) : fail(new Error('no picture'))), 'image/png'))
}
