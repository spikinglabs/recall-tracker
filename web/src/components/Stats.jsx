import { useEffect, useMemo, useState } from 'preact/hooks'
import { computeStats, REGIONS } from '../stats.js'
import { loadHistory } from './History'
import { regionName } from '../share'
import { homePath } from '../paths.js'

// The statistics page (/stats/): the past year from the list, ten years from the history file.
// One colour for every bar, as each chart shows one measure; the numbers are written beside the bars.

const Bars = ({ rows, label, total, unit }) => {
    const max = Math.max(1, ...rows.map(([, n]) => n))
    return (
        <ul class="bars">
            {rows.map(([k, n]) => (
                <li key={k}>
                    <span class="bar-label">{label(k)}</span>
                    <span class="bar-track"><span class="bar" style={{ width: `${(100 * n) / max}%` }} /></span>
                    <span class="bar-n">{n.toLocaleString(unit)}{total ? <small> · {Math.round((100 * n) / total)}%</small> : null}</span>
                </li>
            ))}
        </ul>
    )
}

export function Stats({ recalls, loading, t, lang }) {
    const [history, setHistory] = useState(null)
    useEffect(() => { loadHistory().then(setHistory).catch(() => {}) }, [])
    const s = useMemo(() => computeStats(recalls, history), [recalls, history])
    const monthName = (m) => new Date(`${m}-15`).toLocaleDateString(lang, { month: 'short' })
    const monthLong = (m) => new Date(`${m}-15`).toLocaleDateString(lang, { month: 'long', year: 'numeric' })
    const maxMonth = Math.max(1, ...s.months.map(([, n]) => n))
    const ukFrom = s.years?.find(r => r.gb !== null)?.year

    return (
        <>
            <section class="ask">
                <h1>{t.statsTitle}</h1>
                <p class="sub">{t.statsIntro}</p>
            </section>
            {loading ? <p class="small">{t.statsLoading}</p> : (
                <div class="stats">
                    <div class="tiles">
                        <div class="tile big"><b>{s.total.toLocaleString(lang)}</b><span>{t.statsTotal}</span></div>
                        {REGIONS.map(r => (
                            <div class="tile" key={r}><b>{(s.regions[r] || 0).toLocaleString(lang)}</b><span>{t.statsRegions[r]}</span></div>
                        ))}
                    </div>

                    <section class="chart">
                        <h2>{t.statsPerMonth}</h2>
                        <div class="cols" role="img" aria-label={s.months.map(([m, n]) => `${monthLong(m)}: ${n}`).join(', ')}>
                            {s.months.map(([m, n]) => (
                                <div class="col" key={m} title={`${monthLong(m)}: ${n}`}>
                                    <span class="col-n">{n}</span>
                                    <span class="col-bar" style={{ height: `calc((100% - 16px) * ${n / maxMonth})` }} />
                                    <span class="col-label">{monthName(m)}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section class="chart">
                        <h2>{t.statsHazards}</h2>
                        <Bars rows={s.hazards} label={k => t.hazards[k] || k} total={s.total} unit={lang} />
                        <p class="small">{t.statsHazardNote.replace('{n}', s.total.toLocaleString(lang))}</p>
                    </section>

                    {s.categories.length > 0 && (
                        <section class="chart">
                            <h2>{t.statsKinds}</h2>
                            <Bars rows={s.categories} label={k => t.categories[k] || k} unit={lang} />
                            {s.unsorted > 0 && <p class="small">{t.statsUnsorted.replace('{n}', s.unsorted.toLocaleString(lang))}</p>}
                        </section>
                    )}

                    {s.reporters.length > 0 && (
                        <section class="chart">
                            <h2>{t.statsReporters}</h2>
                            <Bars rows={s.reporters} label={k => regionName(k, lang)} unit={lang} />
                            <p class="small">{t.statsReportersNote}</p>
                        </section>
                    )}

                    {s.years && (
                        <section class="chart">
                            <h2>{t.statsYears}</h2>
                            <table class="years">
                                <thead><tr><th /> {REGIONS.map(r => <th key={r}>{t.statsRegions[r]}</th>)}</tr></thead>
                                <tbody>
                                    {[...s.years].reverse().map(row => (
                                        <tr key={row.year}>
                                            <th>{row.year}</th>
                                            {REGIONS.map(r => <td key={r}>{row[r] === null ? '–' : row[r].toLocaleString(lang)}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p class="small">{t.statsYearsNote.replace('{year}', ukFrom || '')}</p>
                        </section>
                    )}

                    <p class="small">{t.statsPdata.replace('{sources}', s.sources.map(([k]) => k).join(', '))}</p>
                    <p><a class="link-btn" href={homePath(lang)}>← {t.statsBack}</a></p>
                </div>
            )}
        </>
    )
}
