import { useState, useRef, useEffect } from 'preact/hooks'
import { Icon } from '../icons'

const regionName = (code, lang) => {
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code } catch { return code }
}

// The search box, then the countries as round buttons and the product types as chips, as on Allo Outings.
export function SearchBar({ query, onSearch, onSaveHistory, searchHistory, countries, selectedCountry, onCountryChange, categories, categoryCounts, selectedCategory, onCategoryChange, t, lang }) {
    const [isFocused, setIsFocused] = useState(false)
    const containerRef = useRef(null)

    // Close the recent searches when clicking elsewhere.
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsFocused(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onSaveHistory(query)
            setIsFocused(false)
        }
    }

    const handleHistoryClick = (historyItem) => {
        onSearch(historyItem)
        onSaveHistory(historyItem)
        setIsFocused(false)
    }

    const history = (searchHistory || []).filter(h => h.toLowerCase() !== query.trim().toLowerCase())
    const category = categories.includes(selectedCategory) ? selectedCategory : 'All'

    return (
        <div>
            <div class="search-wrap" ref={containerRef}>
                <label class="search">
                    <Icon name="search" />
                    <input
                        type="search"
                        placeholder={t.searchPlaceholder}
                        aria-label={t.searchPlaceholder}
                        value={query}
                        onInput={(e) => onSearch(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onKeyDown={handleKeyDown}
                    />
                    {query && <button type="button" class="search-clear" aria-label="×" onClick={() => onSearch('')}>×</button>}
                </label>
                {isFocused && history.length > 0 && (
                    <ul class="history">
                        {history.map((item) => (
                            <li
                                key={item}
                                onMouseDown={(e) => {
                                    // Keep the input focused until the click lands.
                                    e.preventDefault()
                                    handleHistoryClick(item)
                                }}
                            >
                                {item}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {countries.length > 2 && (
                <div class="when" role="group" aria-label={t.allCountries}>
                    {countries.map(c => (
                        <button key={c} type="button" aria-pressed={selectedCountry === c ? 'true' : 'false'} onClick={() => onCountryChange(c)}>
                            {c === 'All' ? t.allCountries : regionName(c, lang)}
                        </button>
                    ))}
                </div>
            )}

            {categories.length > 1 && (
                <div class="filters" role="group" aria-label={t.allCategories}>
                    {categories.map(c => (
                        <button key={c} type="button" class="chip" aria-pressed={category === c ? 'true' : 'false'} onClick={() => onCategoryChange(c)}>
                            {c === 'All' ? t.allCategories : (t.categories[c] || c)}
                            {c !== 'All' && <span class="n">{categoryCounts[c] || 0}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
