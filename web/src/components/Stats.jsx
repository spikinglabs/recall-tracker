import { useEffect, useMemo, useState } from 'preact/hooks'
import { computeStats, ranges as rangesFor, REGIONS } from '../stats.js'
import { binName, chartTitle, periodText, rangeLabel, statsPosterPng, statsShareText, takeaway } from '../statsPoster.js'
import { loadHistory } from './History'
import { PictureSheet } from './PosterSheet'
import { regionName } from '../share'
import { homePath } from '../paths.js'
import { Icon } from '../icons'
import { track } from '../track.js'

// The statistics page (/stats/): a time range, then one card per chart, each with its takeaway and a poster
// button (statsPoster.js) to share it as a picture. One colour per chart, the top value in red, numbers written out.

const Bars = ({ rows, label, total, lang }) => {
    const max = Math.max(1, ...rows.map(([, n]) => n))
    return (
        <ul class="bars">
            {rows.map(([k, n], i) => (
                <li key={k} class={i === 0 ? 'top' : ''}>
                    <span class="bar-label">{label(k)}</span>
                    <span class="bar-n">{n.toLocaleString(lang)}{total ? <small> · {Math.round((100 * n) / Math.max(1, total))}%</small> : null}</span>
                    <span class="bar-track"><span class="bar" style={{ width: `${(100 * n) / max}%` }} /></span>
                </li>
            ))}
        </ul>
    )
}

const Card = ({ kind, s, t, lang, onPoster, children, note }) => {
    const say = kind === 'overview' ? '' : takeaway(kind, s, t, lang)
    return (
        <section class="chart">
            <div class="chart-head">
                <h2>{chartTitle(kind, s, t)}</h2>
                <button type="button" class="btn icon" title={t.statsPoster} onClick={() => { track('stats_poster'); onPoster(kind) }}>
                    <Icon name="image" /><span>{t.statsPoster}</span>
                </button>
            </div>
            {say && <p class="say">{say}</p>}
            {children}
            {note && <p class="small">{note}</p>}
        </section>
    )
}

const store = {
    get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
    set: (k, v) => { try { localStorage.setItem(k, v) } catch {} },
}

export function Stats({ recalls, loading, t, lang }) {
    const [history, setHistory] = useState(null)
    useEffect(() => { loadHistory().then(setHistory).catch(() => {}) }, [])
    const options = useMemo(() => rangesFor(history), [history])
    const [rangeId, setRangeId] = useState(() => new URLSearchParams(location.search).get('range') || store.get('statsRange') || '12m')
    const range = options.find(r => r.id === rangeId) || options.find(r => r.id === '12m')
    const pick = (id) => {
        setRangeId(id)
        store.set('statsRange', id)
        const u = new URL(location.href)
        u.searchParams.set('range', id)
        history_replace(u)
    }
    const s = useMemo(() => computeStats(recalls, history, range), [recalls, history, range.id])
    const [poster, setPoster] = useState(null)
    const job = poster && {
        key: `${poster}-${range.id}-${s.total}`,
        draw: () => statsPosterPng(poster, s, t, lang),
        name: `allo-recalls-${poster}-${range.id}.png`,
        title: t.statsShareTitle,
        text: () => statsShareText(poster, s, t, lang),
        xhs: () => statsShareText(poster, s, t, lang, true),
    }
    const maxBin = Math.max(1, ...s.time.map(b => b.n))
    const topBin = s.time.reduce((m, b) => (!b.partial && b.n > m ? b.n : m), 0)
    const details = s.detailsFrom && t.statsDetailsFrom.replace('{date}', new Date(s.detailsFrom).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' }))

    return (
        <>
            <section class="ask">
                <h1>{t.statsTitle}</h1>
                <p class="sub">{t.statsIntro}</p>
                <div class="chips ranges" role="group" aria-label={t.statsRange}>
                    {options.map(r => (
                        <button key={r.id} type="button" class="chip" aria-pressed={r.id === range.id ? 'true' : 'false'} onClick={() => pick(r.id)}>
                            {rangeLabel(r, t)}
                        </button>
                    ))}
                </div>
            </section>
            {loading ? <p class="small">{t.statsLoading}</p> : (
                <div class="stats">
                    <section class="chart hero-card">
                        <div class="chart-head">
                            <p class="period">{periodText(range, lang)}</p>
                            <button type="button" class="btn icon" title={t.statsPoster} onClick={() => { track('stats_poster'); setPoster('overview') }}>
                                <Icon name="image" /><span>{t.statsPoster}</span>
                            </button>
                        </div>
                        <p class="big"><b>{s.total.toLocaleString(lang)}</b> {t.statsTotal}</p>
                        <div class="tiles">
                            {REGIONS.map(r => (
                                <div class="tile" key={r}><b>{(s.regions[r] || 0).toLocaleString(lang)}</b><span>{t.statsRegions[r]}</span></div>
                            ))}
                        </div>
                        {s.ukFrom && <p class="small">{t.statsUkFrom.replace('{year}', s.ukFrom)}</p>}
                    </section>

                    <Card kind="time" s={s} t={t} lang={lang} onPoster={setPoster}>
                        <div class="cols" role="img" aria-label={s.time.map(b => `${binName(b, lang, true)}: ${b.n}`).join(', ')}>
                            {s.time.map((b, i) => (
                                <div class={`col${b.partial ? ' partial' : ''}${b.n === topBin && b.n ? ' top' : ''}`} key={b.key} title={`${binName(b, lang, true)}: ${b.n}${b.partial ? ` (${t.statsSoFar})` : ''}`}>
                                    <span class="col-n">{b.n}</span>
                                    <span class="col-bar" style={{ height: `calc((100% - 18px) * ${b.n / maxBin})` }} />
                                    {(s.time.length <= 8 || i % 2 === 0) && <span class="col-label">{binName(b, lang)}</span>}
                                </div>
                            ))}
                        </div>
                    </Card>

                    {s.hazards.length > 0 && (
                        <Card kind="hazards" s={s} t={t} lang={lang} onPoster={setPoster}
                            note={[t.statsHazardNote.replace('{n}', s.detailed.toLocaleString(lang)), details].filter(Boolean).join(' ')}>
                            <Bars rows={s.hazards} label={k => t.hazards[k] || k} total={s.detailed} lang={lang} />
                        </Card>
                    )}

                    {s.categories.length > 0 && (
                        <Card kind="kinds" s={s} t={t} lang={lang} onPoster={setPoster}
                            note={[s.unsorted > 0 && t.statsUnsorted.replace('{n}', s.unsorted.toLocaleString(lang)), details].filter(Boolean).join(' ')}>
                            <Bars rows={s.categories} label={k => t.categories[k] || k} total={s.detailed - s.unsorted} lang={lang} />
                        </Card>
                    )}

                    {s.reporters.length > 0 && (
                        <Card kind="reporters" s={s} t={t} lang={lang} onPoster={setPoster} note={[t.statsReportersNote, details].filter(Boolean).join(' ')}>
                            <Bars rows={s.reporters} label={k => regionName(k, lang)} lang={lang} />
                        </Card>
                    )}

                    <p class="small">{t.statsPdata.replace('{sources}', s.sources.map(([k]) => k).join(', '))}</p>
                    <p><a class="link-btn" href={homePath(lang)}>← {t.statsBack}</a></p>
                </div>
            )}
            <PictureSheet job={job} t={t} lang={lang} onClose={() => setPoster(null)} />
        </>
    )
}

const history_replace = (u) => history.replaceState(null, '', u.pathname + u.search)
