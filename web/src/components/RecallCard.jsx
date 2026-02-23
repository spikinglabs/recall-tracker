export function RecallCard({ recall, t, lang }) {
    const getLocal = (field) => {
        if (!field) return ''
        if (typeof field === 'string') return field
        return field[lang] || field['en'] || Object.values(field)[0] || ''
    }

    const localizedReason = getLocal(recall.reason)
    const localizedAnnotation = getLocal(recall.annotation)

    return (
        <article class="recall-card">
            <div class="recall-card-header">
                <h2 class="recall-title">{recall.title}</h2>
                <span class="recall-date">{recall.publish_date}</span>
            </div>

            <div class="recall-meta">
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
                    {recall.location_sold_in.map(loc => (
                        <span key={loc} class="tag">{loc}</span>
                    ))}
                    {recall.country_sold_in && (
                        <span class="tag">{recall.country_sold_in}</span>
                    )}
                </div>
            )}
        </article>
    )
}
