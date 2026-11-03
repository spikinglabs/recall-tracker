import { useState, useEffect } from 'preact/hooks'
import { RecallList } from './components/RecallList'
import { SearchBar } from './components/SearchBar'
import { translations } from './translations'
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
const CATEGORIES = ['food', 'feeding', 'toys', 'sleep', 'travel', 'clothing', 'furniture', 'health', 'other']

export function App() {
  const [recalls, setRecalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('searchQuery') || ''
  })
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('appLang') || 'en'
  })
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
  }, [lang])

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

  const filteredRecalls = recalls.filter(recall => {
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
    const matchesCategory = selectedCategory === 'All' || categories.length < 2 || recall.category === selectedCategory

    return matchesSearch && matchesCountry && matchesCategory
  })

  const t = translations[lang] || translations['en']
  const failedSources = (status?.sources || []).filter(s => !s.ok).map(s => s.name)
  const updated = status?.updated && new Date(status.updated).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main>
      <header class="app-header">
        <div>
          <h1>{t.title}</h1>
          <p class="subtitle">{t.subtitle}</p>
        </div>
        <select
          class="lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
        >
          <option value="en">English (EN)</option>
          <option value="de">Deutsch (DE)</option>
          <option value="es">Español (ES)</option>
          <option value="fr">Français (FR)</option>
          <option value="zh-CN">中文 (ZH)</option>
        </select>
      </header>

      <SearchBar
        query={searchQuery}
        onSearch={handleSearch}
        onSaveHistory={handleSaveToHistory}
        searchHistory={searchHistory}
        countries={uniqueCountries}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        t={t}
      />

      {status && (
        <p class="list-status">
          {updated && t.updated.replace('{date}', updated)}
          {failedSources.length > 0 && <span class="list-warning"> {t.sourceFailed.replace('{sources}', failedSources.join(', '))}</span>}
        </p>
      )}

      {loading && <p>{t.loading}</p>}
      {error && <p>{t.error} {error}</p>}

      {!loading && !error && (
        <RecallList recalls={filteredRecalls} t={t} lang={lang} />
      )}
    </main>
  )
}
