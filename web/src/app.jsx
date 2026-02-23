import { useState, useEffect } from 'preact/hooks'
import { RecallList } from './components/RecallList'
import { SearchBar } from './components/SearchBar'
import './index.css'

const DATA_URL = 'https://pub-f36c3831e82845e4af2d54940ea6c32d.r2.dev/baby/scraped_date=latest/processed.json'

export function App() {
  const [recalls, setRecalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredRecalls = recalls.filter(recall => {
    const query = searchQuery.toLowerCase()
    return (
      (recall.title && recall.title.toLowerCase().includes(query)) ||
      (recall.company && recall.company.toLowerCase().includes(query)) ||
      (recall.reason && recall.reason.toLowerCase().includes(query))
    )
  })

  return (
    <main>
      <header>
        <h1>Recall Tracker</h1>
        <p class="subtitle">Stay informed about the latest product recalls.</p>
      </header>

      <SearchBar query={searchQuery} onSearch={setSearchQuery} />

      {loading && <p>Loading recall data...</p>}
      {error && <p>Error loading data: {error}</p>}

      {!loading && !error && (
        <RecallList recalls={filteredRecalls} />
      )}
    </main>
  )
}
