import { RecallCard } from './RecallCard'

export function RecallList({ recalls }) {
    if (!recalls || recalls.length === 0) {
        return <p>No recalls found.</p>
    }

    return (
        <div class="recall-list">
            {recalls.map((recall) => (
                <RecallCard key={recall.id} recall={recall} />
            ))}
        </div>
    )
}
