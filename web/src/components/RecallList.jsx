import { useState } from 'preact/hooks'
import { RecallCard } from './RecallCard'

// A batch at a time: the full list runs to over a thousand recalls, too much to draw at once on a phone.
// The parent gives a new `key` when the search or filter changes, which starts again from the first batch.
export const PAGE = 24

export function RecallList({ recalls, t, lang, onPoster, only }) {
    const [shown, setShown] = useState(PAGE)
    if (!recalls || recalls.length === 0) {
        return <p class="empty">{t.noRecalls}</p>
    }
    const left = recalls.length - shown
    return (
        <>
            <div class="grid">
                {recalls.slice(0, shown).map((recall) => (
                    <RecallCard key={recall.id} recall={recall} t={t} lang={lang} onPoster={onPoster} only={only} />
                ))}
            </div>
            {left > 0 && (
                <button type="button" class="btn more" onClick={() => setShown(n => n + PAGE)}>
                    {t.showMore.replace('{n}', left.toLocaleString(lang))}
                </button>
            )}
        </>
    )
}
