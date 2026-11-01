// A recall sold in all 16 German states gets one tag for the whole country.
const regionName = (code, lang) => {
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code } catch { return code }
}

export function RecallCard({ recall, t, lang }) {
    const getLocal = (field) => {
        if (!field) return ''
        if (typeof field === 'string') return field
        return field[lang] || field['en'] || Object.values(field)[0] || ''
    }

    const localizedReason = getLocal(recall.reason)
    const localizedAnnotation = getLocal(recall.annotation)
    const localizedTitle = getLocal(recall.title_i18n) || recall.title
    // Keep the original wording nearby: it is what the label and the shop's notice say.
    const showOriginal = localizedTitle !== recall.title

    return (
        <article class="recall-card">
            <div class="recall-card-header">
                <h2 class="recall-title">{localizedTitle}</h2>
                <span class="recall-date">{recall.publish_date}</span>
            </div>

            <div class="recall-meta">
                {showOriginal && (
                    <p class="recall-original"><strong>{t.originalTitle}</strong> {recall.title}</p>
                )}
                {recall.company && (
                    <p><strong>{t.company}</strong> {recall.company}</p>
                )}
                {localizedReason && (
                    <p class="recall-reason">{localizedReason}</p>
                )}
                {localizedAnnotation && (
                    <p>{localizedAnnotation}</p>
                )}
            </div>

            <a
                href={recall.url}
                target="_blank"
                rel="noopener noreferrer"
                class="recall-source-link"
            >
                {t.viewSource} ({recall.source})
            </a>

            {recall.location_sold_in && recall.location_sold_in.length > 0 && (
                <div class="tags">
                    {(recall.location_sold_in.length >= 16 ? [regionName(recall.country_sold_in, lang)] : recall.location_sold_in).map(loc => (
                        <span key={loc} class="tag">{loc}</span>
                    ))}
                    {recall.country_sold_in && recall.location_sold_in.length < 16 && (
                        <span class="tag">{recall.country_sold_in}</span>
                    )}
                </div>
            )}
        </article>
    )
}
