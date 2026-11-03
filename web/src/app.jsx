import { useState, useEffect, useRef } from 'preact/hooks'
import { RecallList } from './components/RecallList'
import { SearchBar } from './components/SearchBar'
import { PosterSheet } from './components/PosterSheet'
import { shortId, typedCode } from './share'
import { translations } from './translations'
import { Icon } from './icons'
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
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('searchQuery') || ''
  })
  // A shared link names one recall (?r=) and the sharer's language (?lang=), used when the reader hasn't chosen one.
  const params = new URLSearchParams(location.search)
  const [lang, setLang] = useState(() => {
    const shared = params.get('lang')
    return localStorage.getItem('appLang') || (shared && translations[shared] ? shared : 'en')
  })
  const [onlyId, setOnlyId] = useState(() => params.get('r'))
  const [poster, setPoster] = useState(null)
  const showAll = () => {
    setOnlyId(null)
    if (typedCode(searchQuery)) setSearchQuery('')
    history.replaceState(null, '', location.pathname)
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
    document.title = (translations[lang] || translations.en).title
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

  const matching = recalls.filter(recall => {
    const query = searchQuery.toLowerCase()

    // Safely get the localized reason or annotation if it's a dict, or fallback to original string
    const getLocal = (field) => {
      if (!field) return ''
      if (typeof field === 'string') return field
      return field[lang] || field['en'] || Object.values(field)[0] || ''
    }

    const titleCmp = [recall.title, getLocal(recall.title_i18n)].join(' ').toLowerCase()
    const compCmp = (recall.company || '').toLowerCase()
    const reasonCmp = getLocal(recall.reason).toLowerCase()

    const matchesSearch = (
      titleCmp.includes(query) ||
      compCmp.includes(query) ||
      reasonCmp.includes(query)
    )
    const matchesCountry = selectedCountry === 'All' || recall.country_sold_in === selectedCountry
    return matchesSearch && matchesCountry
  })
  const categoryCounts = {}
  for (const r of matching) categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1
  const activeCategory = categories.includes(selectedCategory) ? selectedCategory : 'All'
  const filteredRecalls = activeCategory === 'All' ? matching : matching.filter(r => r.category === activeCategory)
  // The recall a shared link names, shown on its own; a link to a recall that has left the list shows them all.
  // A code typed into the search box (from a poster, or a Rednote note) opens that recall the same way.
  const typed = typedCode(searchQuery)
  const wanted = onlyId || typed
  const sharedRecall = wanted ? recalls.find(r => shortId(r.id) === wanted.toUpperCase()) : null
  const shown = sharedRecall ? [sharedRecall] : filteredRecalls
  // On a phone the shared recall would sit below the search; bring it into view once it's there.
  const sharedId = sharedRecall?.id
  useEffect(() => {
    if (sharedId) document.querySelector('.section')?.scrollIntoView({ block: 'start' })
  }, [sharedId])

  const t = translations[lang] || translations['en']
  const failedSources = (status?.sources || []).filter(s => !s.ok).map(s => s.name)
  const updated = status?.updated && new Date(status.updated).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <>
      <div class="flag" />
      <div class="app">
        <header class="top">
          <a class="brand" href="/">
            <span class="brand-mark"><Icon name="brand" /></span>
            <span>{t.title}</span>
          </a>
          <div class="top-right">
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

        <section class="ask">
          <Hero text={t.hero} />
          <p class="sub">{t.subtitle}</p>
          <SearchBar
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
            <h2>{loading ? t.loading : sharedRecall ? t.sharedTitle : t.count.replace('{n}', filteredRecalls.length.toLocaleString(lang))}</h2>
            {sharedRecall && <button type="button" class="link-btn" onClick={showAll}>{t.showAll.replace('{n}', recalls.length.toLocaleString(lang))}</button>}
            {!sharedRecall && updated && <p>{t.updated.replace('{date}', updated)}</p>}
          </div>
          {error && <p class="empty">{t.error} {error}</p>}
          {!loading && !error && (
            <RecallList recalls={shown} t={t} lang={lang} onPoster={setPoster} only={!!sharedRecall} />
          )}
        </section>
      </div>
      <PosterSheet recall={poster} t={t} lang={lang} onClose={() => setPoster(null)} />
    </>
  )
}
