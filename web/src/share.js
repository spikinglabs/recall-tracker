// Sharing a recall, as on Allo Outings: the phone's share sheet with a short text and the link, copying on
// browsers without one, and a 3:4 poster drawn in the browser to share or save.

export const getLocal = (field, lang) => {
  if (!field) return ''
  if (typeof field === 'string') return field
  return field[lang] || field['en'] || Object.values(field)[0] || ''
}

export const regionName = (code, lang) => {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code } catch { return code }
}

/** The company without the address and product lines that some German notices put in the same field
 *  ("Nestlé Deutschland AG  Baseler Straße 46 …"): the part before the first double space or line break. */
export const companyName = (company) => (company || '').split(/\s{2,}|\n/)[0].trim()

/** A short, stable code for a recall: its id is often the agency's full notice address, too long for a link.
 *  (FNV-1a, 32 bits, in base 36: a clash among a few hundred recalls is about one in ten thousand.) */
export function shortId(id) {
  let h = 0x811c9dc5
  for (const ch of String(id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}

/** The address that opens the site on this one recall, in the sharer's language unless the reader chose one. */
export function recallLink(recall, lang) {
  const u = new URL(location.origin + location.pathname)
  u.searchParams.set('r', shortId(recall.id))
  u.searchParams.set('lang', lang)
  return u.toString()
}

/** The text that goes with the link: what, who, why, and where it comes from. */
export function recallText(recall, t, lang) {
  const title = getLocal(recall.title_i18n, lang) || recall.title
  const reason = getLocal(recall.reason, lang)
  const who = [companyName(recall.company), recall.country_sold_in && regionName(recall.country_sold_in, lang)].filter(Boolean).join(' · ')
  return [`⚠️ ${t.recallTag}: ${title}`, who, reason, t.shareVia.replace('{source}', recall.source)].filter(Boolean).join('\n')
}

/** Inside WeChat (its browser says MicroMessenger), which has no share sheet. */
export const IN_WECHAT = typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent)

/** Share sheet if the browser has one, else copy. Returns 'shared', 'copied', 'closed' or 'failed'. */
export async function shareText({ title, text, url }) {
  if (navigator.share && !IN_WECHAT) {
    try { await navigator.share({ title, text, url }); return 'shared' } catch (e) {
      if (e?.name === 'AbortError') return 'closed'
    }
  }
  return copy(url ? `${text}\n${url}` : text)
}

export async function copy(s) {
  try { await navigator.clipboard.writeText(s); return 'copied' } catch { return 'failed' }
}

// ---------- the poster ----------

export const POSTER = { w: 1080, h: 1440 }
const C = { paper: '#fbfaf6', ink: '#17191b', soft: '#4a4f55', line: '#dddbd5', gold: '#ffcc00', rot: '#d1001f', blau: '#1d4f91' }
const CJK = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", sans-serif'
const BODY = `"Atkinson Hyperlegible", ${CJK}`
const DISPLAY = `"Bricolage Grotesque Variable", "Atkinson Hyperlegible", ${CJK}`
const SIGN = `"Barlow Semi Condensed", "Atkinson Hyperlegible", ${CJK}`

/** Lines of `text` that fit `width` at the context's font; Chinese breaks between any two characters. */
function wrap(ctx, text, width) {
  const words = /[　-鿿]/.test(text) ? [...text] : text.split(/(\s+)/)
  const out = []
  let line = ''
  for (const w of words) {
    const next = line + w
    if (ctx.measureText(next).width > width && line.trim()) { out.push(line.trim()); line = w.trimStart() } else line = next
  }
  if (line.trim()) out.push(line.trim())
  return out
}

/** At most `max` lines; the last one ends in … when the text was longer. */
function clamp(ctx, lines, max, width) {
  if (lines.length <= max) return lines
  const out = lines.slice(0, max)
  let last = out[max - 1]
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1)
  out[max - 1] = `${last.trimEnd()}…`
  return out
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h)
}

/** The recall as a 1080×1440 PNG: German flag strip, the red recall tag, the gold date sign, title, why, and the link. */
export async function posterPng(recall, t, lang, link) {
  await Promise.all(["400 40px 'Atkinson Hyperlegible'", "700 40px 'Atkinson Hyperlegible'", "700 40px 'Barlow Semi Condensed'", "800 40px 'Bricolage Grotesque Variable'"]
    .map(f => document.fonts?.load(f).catch(() => undefined)))
  const { w, h } = POSTER
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  const X = 84, W = w - 2 * X

  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, w, h)
  // The flag strip along the top.
  ;['#000000', '#dd0000', '#ffce00'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 6, w, 6) })

  // Brand: the gold sign with the warning triangle, and the name.
  const by = 84
  ctx.fillStyle = C.gold
  roundRect(ctx, X, by, 72, 72, 16); ctx.fill()
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3
  roundRect(ctx, X + 5, by + 5, 62, 62, 12); ctx.stroke()
  ctx.save(); ctx.translate(X + 12, by + 12); ctx.scale(2, 2)
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.stroke(new Path2D('M12 3.5 2.8 19.5h18.4z')); ctx.stroke(new Path2D('M12 10v4.5')); ctx.stroke(new Path2D('M12 17.2h.01'))
  ctx.restore()
  ctx.fillStyle = C.ink
  ctx.font = `800 44px ${DISPLAY}`
  ctx.textBaseline = 'middle'
  ctx.fillText(t.title, X + 96, by + 38)
  ctx.textBaseline = 'alphabetic'

  // The red recall tag.
  let y = by + 72 + 70
  ctx.font = `700 34px ${SIGN}`
  const tag = t.recallTag.toUpperCase()
  if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'
  const tw = ctx.measureText(tag).width + 44
  ctx.fillStyle = C.rot
  roundRect(ctx, X, y, tw, 58, 29); ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText(tag, X + 22, y + 41)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'

  // The gold date sign, right of the tag line.
  const d = new Date(`${recall.publish_date}T12:00:00`)
  if (!isNaN(d)) {
    const sw = 150, sh = 160, sx = w - X - sw, sy = by - 8
    ctx.fillStyle = C.gold
    roundRect(ctx, sx, sy, sw, sh, 22); ctx.fill()
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4
    roundRect(ctx, sx + 7, sy + 7, sw - 14, sh - 14, 16); ctx.stroke()
    ctx.fillStyle = C.ink
    ctx.textAlign = 'center'
    ctx.font = `700 28px ${SIGN}`
    ctx.fillText(d.toLocaleDateString(lang, { month: 'short' }).replace('.', '').toUpperCase(), sx + sw / 2, sy + 46)
    ctx.font = `700 64px ${SIGN}`
    ctx.fillText(String(d.getDate()), sx + sw / 2, sy + 108)
    ctx.font = `700 26px ${SIGN}`
    ctx.fillText(String(d.getFullYear()), sx + sw / 2, sy + 140)
    ctx.textAlign = 'start'
  }

  // The title, as big as fits in four lines.
  y += 58 + 130
  const title = getLocal(recall.title_i18n, lang) || recall.title
  let size = 84, lines
  for (; size >= 52; size -= 8) {
    ctx.font = `800 ${size}px ${DISPLAY}`
    lines = wrap(ctx, title, W)
    if (lines.length <= 4) break
  }
  lines = clamp(ctx, lines, 4, W)
  ctx.fillStyle = C.ink
  for (const l of lines) { ctx.fillText(l, X, y); y += size * 1.12 }

  // Who and where.
  y += 16
  ctx.font = `400 38px ${BODY}`
  ctx.fillStyle = C.soft
  const who = [companyName(recall.company), recall.country_sold_in && regionName(recall.country_sold_in, lang)].filter(Boolean).join(' · ')
  for (const l of clamp(ctx, wrap(ctx, who, W), 2, W)) { ctx.fillText(l, X, y); y += 50 }

  // Why, under a rule, until the space above the foot runs out.
  y += 30
  ctx.fillStyle = C.rot
  ctx.fillRect(X, y, 96, 8)
  y += 70
  const reason = getLocal(recall.reason, lang)
  const foot = h - 250
  ctx.font = `400 44px ${BODY}`
  ctx.fillStyle = C.ink
  const room = Math.max(1, Math.floor((foot - y) / 62))
  for (const l of clamp(ctx, wrap(ctx, reason, W), room, W)) { ctx.fillText(l, X, y); y += 62 }

  // Foot: what to do, the source, and the address.
  ctx.fillStyle = C.line
  ctx.fillRect(X, foot + 20, W, 3)
  ctx.font = `700 38px ${BODY}`
  ctx.fillStyle = C.ink
  ctx.fillText(clamp(ctx, wrap(ctx, t.posterCheck, W), 1, W)[0], X, foot + 92)
  ctx.font = `400 34px ${BODY}`
  ctx.fillStyle = C.blau
  const shown = link.replace(/^https?:\/\//, '').replace(/[?&]lang=[^&]*/, '')
  ctx.fillText(clamp(ctx, [`${recall.source} · ${shown}`], 1, W)[0], X, foot + 150)

  return new Promise((ok, fail) => cv.toBlob(b => (b ? ok(b) : fail(new Error('no picture'))), 'image/png'))
}
