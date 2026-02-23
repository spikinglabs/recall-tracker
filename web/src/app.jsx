import { useState, useEffect } from 'preact/hooks'
import { RecallList } from './components/RecallList'
import { SearchBar } from './components/SearchBar'
import { translations } from './translations'
import './index.css'

const DATA_URL = 'https://pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev/baby/scraped_date%3Dlatest/processed.json'

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
    fetch(DATA_URL)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok')
        return response.json()
      })
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
  }, [])

  const uniqueCountries = ['All', ...new Set(recalls.map(r => r.country_sold_in).filter(Boolean))].sort()

  const filteredRecalls = recalls.filter(recall => {
    const query = searchQuery.toLowerCase()

    // Safely get the localized reason or annotation if it's a dict, or fallback to original string
    const getLocal = (field) => {
      if (!field) return ''
      if (typeof field === 'string') return field
      return field[lang] || field['en'] || Object.values(field)[0] || ''
    }

    const titleCmp = (recall.title || '').toLowerCase()
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

  const t = translations[lang] || translations['en']
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
        t={t}
      />

      {loading && <p>{t.loading}</p>}
      {error && <p>{t.error} {error}</p>}

      {!loading && !error && (
        <RecallList recalls={filteredRecalls} t={t} lang={lang} />
      )}
    </main>
  )
}
