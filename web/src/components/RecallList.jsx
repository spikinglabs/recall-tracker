import { RecallCard } from './RecallCard'

export function RecallList({ recalls, t, lang, onPoster, only }) {
    if (!recalls || recalls.length === 0) {
        return <p class="empty">{t.noRecalls}</p>
    }

    return (
        <div class="grid">
            {recalls.map((recall) => (
                <RecallCard key={recall.id} recall={recall} t={t} lang={lang} onPoster={onPoster} only={only} />
            ))}
        </div>
    )
}
