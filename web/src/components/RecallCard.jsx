// One recall, laid out like an Allo Outings card: the gold date sign, the title, then what and where.
const regionName = (code, lang) => {
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code } catch { return code }
}

const getLocal = (field, lang) => {
    if (!field) return ''
    if (typeof field === 'string') return field
    return field[lang] || field['en'] || Object.values(field)[0] || ''
}

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

export function RecallCard({ recall, t, lang }) {
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
    const where = places.length && places.length < 16 ? places.join(', ') : ''
    const dateText = isNaN(published) ? recall.publish_date : published.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })

    return (
        <article class="item">
            <Stamp date={recall.publish_date} lang={lang} />
            <div class="item-body">
                <h3><a href={recall.url} target="_blank" rel="noopener noreferrer">{title}</a></h3>
                {original && <p class="orig" lang={recall.country_sold_in === 'DE' ? 'de' : 'en'}>{original}</p>}
                <div class="meta">{[recall.company, country].filter(Boolean).join(' · ')}</div>
                {reason && <p class="reason">{reason}</p>}
                {note && <p class="note">{note}</p>}
                <div class="pills">
                    {isNew && <span class="pill new">{t.newPill}</span>}
                    {recall.category && t.categories[recall.category] && <span class="pill">{t.categories[recall.category]}</span>}
                    {where && <span class="pill where">📍 {where}</span>}
                </div>
                <div class="trust"><b>{t.officialNotice} ↗</b> · {recall.source} · <time datetime={recall.publish_date}>{dateText}</time></div>
            </div>
        </article>
    )
}
