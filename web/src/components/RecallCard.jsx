export function RecallCard({ recall }) {
    return (
        <article class="recall-card">
            <div class="recall-card-header">
                <h2 class="recall-title">{recall.title}</h2>
                <span class="recall-date">{recall.publish_date}</span>
            </div>

            <div class="recall-meta">
                {recall.company && (
                    <p><strong>Company:</strong> {recall.company}</p>
                )}
                {recall.reason && (
                    <p class="recall-reason">{recall.reason}</p>
                )}
                {recall.annotation && (
                    <p>{recall.annotation}</p>
                )}
            </div>

            <a
                href={recall.url}
                target="_blank"
                rel="noopener noreferrer"
                class="recall-source-link"
            >
                View Source ({recall.source})
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
