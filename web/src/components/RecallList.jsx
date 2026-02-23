import { RecallCard } from './RecallCard'

export function RecallList({ recalls, t, lang }) {
    if (!recalls || recalls.length === 0) {
        return <p>{t.noRecalls}</p>
    }

    return (
        <div class="recall-list">
            {recalls.map((recall) => (
                <RecallCard key={recall.id} recall={recall} t={t} lang={lang} />
            ))}
        </div>
    )
}
