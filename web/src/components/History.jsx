import { useEffect, useState } from 'preact/hooks'
import { search } from '../match.js'
import { regionName } from '../share'

// Older recalls for the second-hand check: ten years from the EU, the UK and the US (history.json, built by
// src/history.py), loaded the first time someone searches. Titles stay in their original language.
const URL = 'https://recalls-api.allo.land/baby/scraped_date%3Dlatest/history.json'
let cache = null
const load = () => (cache ||= fetch(URL).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status)))).catch(e => { cache = null; throw e }))

export function History({ query, text, skip, t, lang, foundRecent }) {
    const [data, setData] = useState(null)
    const [failed, setFailed] = useState(false)
    const active = text.trim().length >= 3
    useEffect(() => {
        if (!active || data) return
        load().then(setData).catch(() => setFailed(true))
    }, [active])
    if (!active) return null

    const found = data ? search(data.recalls, query).filter(r => !skip.has(r.id)).slice(0, 40) : []
    const since = data?.since ? new Date(data.since).getFullYear() : null
    const nothing = data && !found.length && !foundRecent
    return (
        <section class="section history-list">
            <div class="section-head">
                <h2>{t.historyTitle}</h2>
                {since && <p>{t.historySince.replace('{year}', since)}</p>}
            </div>
            {!data && !failed && <p class="small">{t.historyLoading}</p>}
            {failed && <p class="small">{t.historyFailed}</p>}
            {nothing && (
                <div class="verdict ok">
                    <p><b>{t.noRecallFound.replace('{q}', text.trim().slice(0, 80))}</b></p>
                    <p class="small">{t.noGuarantee}</p>
                </div>
            )}
            {data && !found.length && foundRecent && <p class="small">{t.historyNone}</p>}
            {found.length > 0 && (
                <ul class="old">
                    {found.map(r => (
                        <li key={r.id}>
                            <span class="old-date">{r.date.slice(0, 4)}</span>
                            <div>
                                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.en || r.title}</a>
                                <div class="small">{[r.company, r.country && regionName(r.country, lang), r.source, r.date].filter(Boolean).join(' · ')}</div>
                                {r.codes && <div class="small codes">{r.codes.slice(0, 6).join(' · ')}</div>}
                                {r.also && <div class="small">{t.alsoReported} {[...new Set(r.also.map(a => a.source))].filter(s => s !== r.source).join(', ')}</div>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
