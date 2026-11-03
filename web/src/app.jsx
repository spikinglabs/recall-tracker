import { useState, useEffect, useRef } from 'preact/hooks'
import { RecallList } from './components/RecallList'
import { SearchBar } from './components/SearchBar'
import { PosterSheet } from './components/PosterSheet'
import { shortId, typedCode } from './share'
import { parseQuery, search } from './match.js'
import { History } from './components/History'
import { Scanner } from './components/Scanner'
import { Stats } from './components/Stats'
import { homePath, parsePath, recallPath, statsPath } from './paths.js'
import { translations } from './translations'
import { Icon } from './icons'
import { alloSites } from './allo.js'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import './index.css'

// The data's address, then the old r2.dev bucket in case the new one can't be reached.
const DATA_BASES = [
  'https://recalls-api.allo.land/baby/scraped_date%3Dlatest/',
  'https://pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev/baby/scraped_date%3Dlatest/',
]
const fetchJson = async (name) => {
  let lastError
  for (const base of DATA_BASES) {
    try {
      const response = await fetch(base + name)
      if (response.ok) return await response.json()
      lastError = new Error(`${response.status} ${response.statusText}`)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}
const LANGS = [['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'], ['zh-CN', '中文']]
const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch {} },
}
// "Recalled [baby and kids' products]": the bracketed words get the gold marker, as on Allo Outings.
const Hero = ({ text }) => {
  const m = text.match(/^(.*)\[(.*)\](.*)$/)
  return <h1>{m ? <>{m[1]}<em>{m[2]}</em>{m[3]}</> : text}</h1>
}
// A flag from the country code, e.g. DE -> 🇩🇪.
const flag = (code) => code.replace(/./g, c => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)))
const regionName = (code, lang) => {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code } catch { return code }
}
const darkNow = () => {
  const set = document.documentElement.dataset.theme
  return set ? set === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
}
const CATEGORIES = ['food', 'feeding', 'toys', 'sleep', 'travel', 'clothing', 'furniture', 'health', 'other']

export function App() {
  const [recalls, setRecalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // ?q= comes from a search engine's site search box (the pages' WebSite data, scripts/prerender.mjs).
  const [searchQuery, setSearchQuery] = useState(() => {
    // A listing shared from another app to the installed site (manifest share_target) comes as title/text/url.
    const p = new URLSearchParams(location.search)
    const shared = p.get('url') || p.get('text') || p.get('title')
    return p.get('q') ?? shared ?? (localStorage.getItem('searchQuery') || '')
  })
  // The address names the language (/de/ …) and may name one recall (/de/r/7KQ3MX/). Older shared links
  // used ?r= and ?lang=. At the root the reader's own choice of language applies.
  const params = new URLSearchParams(location.search)
  const fromPath = parsePath(location.pathname)
  const [lang, setLangState] = useState(() => {
    if (fromPath.lang) return fromPath.lang
    const shared = params.get('lang')
    return localStorage.getItem('appLang') || (shared && translations[shared] ? shared : 'en')
  })
  const [onlyId, setOnlyId] = useState(() => fromPath.code || params.get('r'))
  const onStats = fromPath.stats
  // Choosing a language moves to that language's address, so the address always matches the page.
  const setLang = (l) => {
    setLangState(l)
    history.replaceState(null, '', onStats ? statsPath(l) : onlyId ? recallPath(l, onlyId.toUpperCase()) : homePath(l))
  }
  const [poster, setPoster] = useState(null)
  const [scanning, setScanning] = useState(false)
  const showAll = () => {
    setOnlyId(null)
    if (typedCode(searchQuery)) setSearchQuery('')
    history.replaceState(null, '', homePath(lang))
  }
  const [selectedCountry, setSelectedCountry] = useState(() => {
    return localStorage.getItem('selectedCountry') || 'All'
  })
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return localStorage.getItem('selectedCategory') || 'All'
  })
  // When the list was made and which sources failed today (status.json); the page works without it.
  const [status, setStatus] = useState(null)

  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const history = localStorage.getItem('searchHistory')
      return history ? JSON.parse(history) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('selectedCountry', selectedCountry)
  }, [selectedCountry])

  useEffect(() => {
    localStorage.setItem('selectedCategory', selectedCategory)
  }, [selectedCategory])

  useEffect(() => {
    localStorage.setItem('appLang', lang)
    document.documentElement.lang = lang === 'zh-CN' ? 'zh-Hans' : lang
    const tl = translations[lang] || translations.en
    document.title = onStats ? `${tl.statsTitle} · ${tl.title}` : tl.title
  }, [lang])

  const langMenu = useRef(null)
  const countryMenu = useRef(null)
  const flipTheme = () => {
    const next = darkNow() ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    store.set('rt-theme', next)
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.content = next === 'dark' ? '#121314' : '#ffcc00' })
  }

  useEffect(() => {
    localStorage.setItem('searchQuery', searchQuery)
  }, [searchQuery])

  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory))
  }, [searchHistory])

  const handleSearch = (newQuery) => {
    setSearchQuery(newQuery)
  }

  const handleSaveToHistory = (queryToSave) => {
    const trimmed = queryToSave.trim()
    if (!trimmed) return
    setSearchHistory(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase())
      return [trimmed, ...filtered].slice(0, 10) // Keep last 10
    })
  }

  useEffect(() => {
    fetchJson('processed.json')
      .then(data => {
        // Sort by publish_date descending
        const sortedData = data.sort((a, b) => new Date(b.publish_date) - new Date(a.publish_date))
        setRecalls(sortedData)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
    fetchJson('status.json')
      .then(setStatus)
      .catch(() => {})
  }, [])

  const uniqueCountries = ['All', ...new Set(recalls.map(r => r.country_sold_in).filter(Boolean))].sort()
  // Only offer categories that appear in the list (none until the classification step has run).
  const presentCategories = new Set(recalls.map(r => r.category).filter(Boolean))
  const categories = ['All', ...CATEGORIES.filter(c => presentCategories.has(c))]

  // Brand, model, barcode, a pasted listing title or link (src/match.js); the best matches first.
  const query = parseQuery(searchQuery)
  const inCountry = (recall) => {
    // EU Safety Gate alerts concern the whole single market, so they show with Germany too, and German ones with the EU.
    const cc = recall.country_sold_in
    return selectedCountry === 'All' || cc === selectedCountry ||
      (selectedCountry !== 'US' && cc !== 'US' && (cc === 'EU' || selectedCountry === 'EU'))
  }
  const matching = (searchQuery.trim() ? search(recalls, query) : recalls).filter(inCountry)
  const categoryCounts = {}
  for (const r of matching) categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : 'All'
  const filteredRecalls = activeCategory === 'All' ? matching : matching.filter(r => r.category === activeCategory)
  // The recall a shared link names, shown on its own; a link to a recall that has left the list shows them all.
  // A code typed into the search box (from a poster, or a Rednote note) opens that recall the same way.
  const typed = typedCode(searchQuery)
  const wanted = onlyId || typed
  // A code can also name a report that was folded into another recall as a duplicate.
  const sharedRecall = wanted ? recalls.find(r => [r, ...(r.also || [])].some(x => shortId(x.id) === wanted.toUpperCase())) : null
  const shown = sharedRecall ? [sharedRecall] : filteredRecalls
  // On a phone the shared recall would sit below the search; bring it into view once it's there.
  const sharedId = sharedRecall?.id
  useEffect(() => {
    if (sharedId) document.querySelector('.section')?.scrollIntoView({ block: 'start' })
  }, [sharedId])

  // Recalls already in the list above (with the reports folded into them) aren't repeated among the older ones.
  const knownIds = new Set(recalls.flatMap(r => [r.id, ...(r.also || []).map(a => a.id)]))
  const t = translations[lang] || translations['en']
  const failedSources = (status?.sources || []).filter(s => !s.ok).map(s => s.name)
  const updated = status?.updated && new Date(status.updated).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <>
      <div class="flag" />
      <div class="app">
        <header class="top">
          <a class="brand" href={homePath(lang)}>
            <span class="brand-mark"><Icon name="brand" /></span>
            <span>{t.title}</span>
          </a>
          <div class="top-right">
            <a class="theme-flip stats-link" href={statsPath(lang)} aria-label={t.statsLink} title={t.statsLink} aria-current={onStats ? 'page' : undefined}>
              <Icon name="chart" />
            </a>
            <button type="button" class="theme-flip" aria-label={t.themeFlip} title={t.themeFlip} onClick={flipTheme}>
              <span class="theme-moon"><Icon name="moon" /></span>
              <span class="theme-sun"><Icon name="sun" /></span>
            </button>
            {uniqueCountries.length > 2 && (
              <details class="lang" ref={countryMenu}>
                <summary aria-label={t.country} title={t.country}>
                  <span class="flag-emoji">{selectedCountry === 'All' ? '🌍' : flag(selectedCountry)}</span>
                </summary>
                <div class="lang-menu">
                  {uniqueCountries.map(c => (
                    <button key={c} type="button" aria-current={selectedCountry === c ? 'true' : 'false'} onClick={() => { setSelectedCountry(c); countryMenu.current.open = false }}>
                      {c === 'All' ? `🌍 ${t.allCountries}` : `${flag(c)} ${regionName(c, lang)}`}
                    </button>
                  ))}
                </div>
              </details>
            )}
            <details class="lang" ref={langMenu}>
              <summary aria-label={t.language} title={t.language}>
                <Icon name="globe" />
                <span>{lang === 'zh-CN' ? '中' : lang.toUpperCase()}</span>
              </summary>
              <div class="lang-menu">
                {LANGS.map(([code, name]) => (
                  <button key={code} type="button" aria-current={lang === code ? 'true' : 'false'} onClick={() => { setLang(code); langMenu.current.open = false }}>{name}</button>
                ))}
              </div>
            </details>
          </div>
        </header>

        {onStats ? <Stats recalls={recalls} loading={loading} t={t} lang={lang} /> : (<>
        <section class="ask">
          <Hero text={t.hero} />
          <p class="sub">{t.subtitle}</p>
          <SearchBar
            onScan={() => setScanning(true)}
            query={searchQuery}
            onSearch={handleSearch}
            onSaveHistory={handleSaveToHistory}
            searchHistory={searchHistory}
            categories={categories}
            categoryCounts={categoryCounts}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            t={t}
            lang={lang}
          />
        </section>

        <section class="section">
          {failedSources.length > 0 && <p class="alerts">{t.sourceFailed.replace('{sources}', failedSources.join(', '))}</p>}
          {onlyId && !loading && !sharedRecall && <p class="alerts">{t.sharedGone}</p>}
          <div class="section-head">
            <h2>{loading ? t.loading : sharedRecall ? t.sharedTitle : (filteredRecalls.length === 1 && t.countOne ? t.countOne : t.count.replace('{n}', filteredRecalls.length.toLocaleString(lang)))}</h2>
            {sharedRecall && <button type="button" class="link-btn" onClick={showAll}>{t.showAll.replace('{n}', recalls.length.toLocaleString(lang))}</button>}
            {!sharedRecall && updated && <p>{t.updated.replace('{date}', updated)} <a href={statsPath(lang)}>{t.statsLink} →</a></p>}
          </div>
          {error && <p class="empty">{t.error} {error}</p>}
          {!loading && !error && (
            <RecallList key={`${searchQuery}|${selectedCountry}|${activeCategory}|${sharedRecall?.id || ''}`} recalls={shown} t={t} lang={lang} onPoster={setPoster} only={!!sharedRecall} />
          )}
        </section>
        {!loading && !sharedRecall && (
          <History query={query} text={searchQuery} skip={knownIds} foundRecent={filteredRecalls.length > 0} t={t} lang={lang} />
        )}
        </>)}
        <footer class="family">
          <h2>{t.moreAllo}</h2>
          <ul>
            {alloSites(lang).map(site => (
              <li key={site.id}><a href={site.url}><b>{site.name}</b><span>{t.allo[site.id]}</span></a></li>
            ))}
          </ul>
        </footer>
      </div>
      <PosterSheet recall={poster} t={t} lang={lang} onClose={() => setPoster(null)} />
      <Scanner open={scanning} t={t} onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); setSearchQuery(code); handleSaveToHistory(code) }} />
    </>
  )
}
