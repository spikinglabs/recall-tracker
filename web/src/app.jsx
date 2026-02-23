import { useState, useEffect } from 'preact/hooks'
import { RecallList } from './components/RecallList'
import { SearchBar } from './components/SearchBar'
import './index.css'

const DATA_URL = 'https://pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev/baby/scraped_date%3Dlatest/processed.json'

export function App() {
  const [recalls, setRecalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem('searchQuery') || ''
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
    const matchesSearch = (
      (recall.title && recall.title.toLowerCase().includes(query)) ||
      (recall.company && recall.company.toLowerCase().includes(query)) ||
      (recall.reason && recall.reason.toLowerCase().includes(query))
    )
    const matchesCountry = selectedCountry === 'All' || recall.country_sold_in === selectedCountry

    return matchesSearch && matchesCountry
  })
  return (
    <main>
      <header>
        <h1>Recall Tracker</h1>
        <p class="subtitle">Stay informed about the latest product recalls.</p>
      </header>

      <SearchBar
        query={searchQuery}
        onSearch={handleSearch}
        onSaveHistory={handleSaveToHistory}
        searchHistory={searchHistory}
        countries={uniqueCountries}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
      />

      {loading && <p>Loading recall data...</p>}
      {error && <p>Error loading data: {error}</p>}

      {!loading && !error && (
        <RecallList recalls={filteredRecalls} />
      )}
    </main>
  )
}
