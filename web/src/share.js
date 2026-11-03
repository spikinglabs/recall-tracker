import { recallPath } from './paths.js'

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
// German notices run the address and the product line on after the name ("…UnnaProduktbezeichnung/ -beschreibung: …"),
// and some start with "Importeur:" or "Inverkehrbringer:". Keep the first name only, without a trailing comma.
export const companyName = (company) => (company || '')
  .split(/Produktbezeichnung/)[0]
  .replace(/^\s*(Importeur|Inverkehrbringer|Hersteller)[^:\n]*:\s*/i, '')
  .split(/\s{2,}|\n/)[0]
  .replace(/[\s,;]+$/, '')
  .trim()

/** Letters and digits that can't be mistaken for each other (no 0/O, no 1/I/L), as in Allo Outings' codes. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE = /^[2-9A-HJKMNP-Z]{6}$/

/** A recall's six-character code, like "7KQ3MX": in its link (?r=), and on the poster for typing into the
 *  site's search box, since Rednote punishes links. It comes from the recall's id (often the agency's full
 *  notice address), so it stays the same every day. FNV-1a, 32 bits, as in Allo Outings (src/lib/rednote-code.ts). */
export function shortId(id) {
  let h = 0x811c9dc5
  for (const ch of String(id)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0 }
  let out = ''
  for (let i = 0; i < 6; i++) { out += ALPHABET[h % ALPHABET.length]; h = Math.floor(h / ALPHABET.length) }
  return out
}

/** What someone typed into the search box, as a code, or null. */
export const typedCode = (q) => {
  const c = (q || '').trim().toUpperCase()
  return CODE.test(c) ? c : null
}

/** What the poster's search box says: the name Chinese readers search for, the address for everyone else. */
export const SEARCH_ZH = '小鹿召回 Allo Recalls'
export const searchFor = (lang) => (lang === 'zh-CN' ? SEARCH_ZH : 'recalls.allo.land')

/** The text for Rednote: no link (Rednote punishes them), the name to search for and the code, and tags. */
export function rednoteText(recall, t) {
  const title = getLocal(recall.title_i18n, 'zh-CN') || recall.title
  const reason = getLocal(recall.reason, 'zh-CN')
  const who = [companyName(recall.company), recall.country_sold_in && regionName(recall.country_sold_in, 'zh-CN')].filter(Boolean).join(' · ')
  const tags = ['德国带娃', '召回', '母婴好物避雷', '宝宝用品', '德国生活', '德国妈妈']
  if (recall.country_sold_in === 'US') tags.splice(4, 2, '美国带娃', '海淘')
  if (recall.country_sold_in === 'EU') tags.splice(4, 0, '欧洲带娃')
  return [
    `⚠️ 召回：${title}`, who, reason, '',
    `信息来自官方通知（${recall.source}），家里有的话请停止使用，按通知处理。`,
    `浏览器搜索「${SEARCH_ZH}」，在网站搜索框输入编号 ${shortId(recall.id)} 就能看到这条召回，还有更多德国、欧盟和美国的婴幼儿产品召回。`,
    '',
    tags.map(x => `#${x}`).join(' '),
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
}

/** The address that opens the site on this one recall, in the sharer's language unless the reader chose one. */
export function recallLink(recall, lang) {
  return location.origin + recallPath(lang, shortId(recall.id))
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
export async function posterPng(recall, t, lang) {
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
  const foot = h - 260
  ctx.font = `400 44px ${BODY}`
  ctx.fillStyle = C.ink
  const room = Math.max(1, Math.floor((foot - 80 - y) / 62) + 1)
  for (const l of clamp(ctx, wrap(ctx, reason, W), room, W)) { ctx.fillText(l, X, y); y += 62 }

  // Foot: what to do; then, with no link so the picture can go anywhere (Rednote included), a search box
  // with the site to search for and the recall's code to type into the site's search box.
  ctx.font = `700 38px ${BODY}`
  ctx.fillStyle = C.ink
  ctx.fillText(clamp(ctx, wrap(ctx, t.posterCheck, W), 1, W)[0], X, foot - 6)
  const code = shortId(recall.id)
  ctx.font = `700 56px ${SIGN}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'
  const cw = ctx.measureText(code).width + 56
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  const boxY = foot + 40, boxH = 104, boxW = W - cw - 20
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, X, boxY, boxW, boxH, boxH / 2); ctx.fill()
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3
  roundRect(ctx, X, boxY, boxW, boxH, boxH / 2); ctx.stroke()
  ctx.strokeStyle = '#5b6066'; ctx.lineWidth = 6; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.arc(X + 58, boxY + 47, 17, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(X + 71, boxY + 60); ctx.lineTo(X + 86, boxY + 75); ctx.stroke()
  ctx.fillStyle = C.ink
  let sz = 44
  const what = searchFor(lang)
  for (; sz > 28; sz -= 2) { ctx.font = `700 ${sz}px ${BODY}`; if (ctx.measureText(what).width <= boxW - 130) break }
  ctx.textBaseline = 'middle'
  ctx.fillText(what, X + 110, boxY + boxH / 2 + 2)
  // The code, in Verkehrsblau like Outings' codes.
  ctx.fillStyle = C.blau
  roundRect(ctx, X + W - cw, boxY, cw, boxH, 14); ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 56px ${SIGN}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'
  ctx.textAlign = 'center'
  ctx.fillText(code, X + W - cw / 2, boxY + boxH / 2 + 3)
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
  ctx.font = `400 30px ${BODY}`
  ctx.fillStyle = C.soft
  ctx.fillText(clamp(ctx, wrap(ctx, t.posterCode.replace('{source}', recall.source), W), 1, W)[0], X, boxY + boxH + 52)

  return new Promise((ok, fail) => cv.toBlob(b => (b ? ok(b) : fail(new Error('no picture'))), 'image/png'))
}
