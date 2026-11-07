// One recall, laid out like an Allo Outings card: the gold date sign, the title, then what and where.
import { useState } from 'preact/hooks'
import { Icon } from '../icons'
import { companyName, copy, getLocal, recallLink, recallText, regionName, shareText } from '../share'
import { track } from '../track.js'

// A recall published in the last two weeks that the tracker found in the last week. (Every recall has a
// first_seen of 1 Nov 2026 or later, when the archive started, so first_seen alone would mark them all new.)
const NEW_DAYS = 7
const RECENT_DAYS = 14

function Stamp({ date, lang }) {
    const d = new Date(`${date}T12:00:00`)
    if (isNaN(d)) return <div class="stamp" aria-hidden="true"><div class="d">?</div></div>
    return (
        <div class="stamp" aria-hidden="true">
            <div class="m">{d.toLocaleDateString(lang, { month: 'short' }).replace('.', '')}</div>
            <div class="d">{d.getDate()}</div>
            <div class="y">{d.getFullYear()}</div>
        </div>
    )
}

// Share (text and link through the phone's share sheet, copied where there is none), copy the link, and the
// poster. The button says what happened for a moment, as on Allo Outings.
function ShareRow({ recall, t, lang, onPoster }) {
    const [done, setDone] = useState(null)
    const flash = (key) => { setDone(key); setTimeout(() => setDone(null), 2500) }
    const link = () => recallLink(recall, lang)
    const share = async () => {
        track('share')
        const r = await shareText({ title: t.recallTag, text: recallText(recall, t, lang), url: link() })
        if (r === 'copied') flash('share')
        else if (r === 'failed') prompt(t.copyLink, link())
    }
    const copyLink = async () => {
        track('copy_link')
        if ((await copy(link())) === 'copied') flash('link'); else prompt(t.copyLink, link())
    }
    return (
        <div class="share-row">
            <button type="button" class="btn icon" title={t.share} onClick={share}>
                <Icon name="share" /><span class={done === 'share' ? '' : 'sr-only'}>{done === 'share' ? t.shareCopied : t.share}</span>
            </button>
            <button type="button" class="btn icon" title={t.copyLink} onClick={copyLink}>
                <Icon name="link" /><span class={done === 'link' ? '' : 'sr-only'}>{done === 'link' ? t.linkCopied : t.copyLink}</span>
            </button>
            <button type="button" class="btn icon" title={t.poster} onClick={() => onPoster(recall)}>
                <Icon name="image" /><span class="sr-only">{t.poster}</span>
            </button>
        </div>
    )
}

export function RecallCard({ recall, t, lang, onPoster, only }) {
    const reason = getLocal(recall.reason, lang)
    const note = getLocal(recall.annotation, lang)
    const title = getLocal(recall.title_i18n, lang) || recall.title
    // Keep the original wording nearby: it is what the label and the shop's notice say.
    // Shown only when it says something else, not when just quotes or capitals differ.
    const plain = (x) => (x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    const original = plain(title) !== plain(recall.title) ? recall.title : null
    const seen = recall.first_seen ? new Date(recall.first_seen) : null
    const published = new Date(`${recall.publish_date}T12:00:00`)
    const isNew = Date.now() - published.getTime() < RECENT_DAYS * 864e5 && (!seen || Date.now() - seen.getTime() < NEW_DAYS * 864e5)
    const country = recall.country_sold_in ? regionName(recall.country_sold_in, lang) : ''
    const places = recall.location_sold_in || []
    // Sold in all 16 German states: one word for the whole country.
    // EU alerts name the country whose authority found the product; it may be sold anywhere in Europe.
    const where = recall.country_sold_in === 'EU'
        ? (places.length ? t.reportedIn.replace('{country}', places.map(c => regionName(c, lang)).join(', ')) : '')
        : places.length && places.length < 16 ? places.join(', ') : ''
    // Other reports of the same product: one link per source (the UK writes one report per shop).
    const also = [...new Map((recall.also || []).filter(a => a.source !== recall.source).map(a => [a.source, a])).values()]
    // Barcodes and model numbers, to compare with the product in hand.
    const codes = [...new Set([...(recall.codes || []), ...(recall.also || []).flatMap(a => a.codes || [])])]
    const dateText = isNaN(published) ? recall.publish_date : published.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })

    return (
        <article class={only ? "item only" : "item"}>
            <Stamp date={recall.publish_date} lang={lang} />
            <div class="item-body">
                <h3><a href={recall.url} target="_blank" rel="noopener noreferrer">{title}</a></h3>
                {original && <p class="orig" lang={recall.country_sold_in === 'DE' ? 'de' : 'en'}>{original}</p>}
                <div class="meta">{[companyName(recall.company), country].filter(Boolean).join(' · ')}</div>
                {reason && <p class="reason">{reason}</p>}
                {codes.length > 0 && <p class="codes small"><span>{t.codesLabel}</span> {codes.slice(0, 6).join(' · ')}{codes.length > 6 ? ' …' : ''}</p>}
                {note && <p class="note">{note}</p>}
                <div class="pills">
                    {isNew && <span class="pill new">{t.newPill}</span>}
                    {recall.category && t.categories[recall.category] && <span class="pill">{t.categories[recall.category]}</span>}
                    {where && <span class="pill where"><span aria-hidden="true">📍</span><span>{where}</span></span>}
                </div>
                <div class="trust"><b>{t.officialNotice} ↗</b> · {recall.source} · <time datetime={recall.publish_date}>{dateText}</time></div>
                {also.length > 0 && (
                    <div class="trust also">{t.alsoReported}{' '}
                        {also.map((a, i) => <span key={a.url}>{i > 0 && ' · '}<a href={a.url} target="_blank" rel="noopener noreferrer">{a.source} ↗</a></span>)}
                    </div>
                )}
                <ShareRow recall={recall} t={t} lang={lang} onPoster={onPoster} />
            </div>
        </article>
    )
}
