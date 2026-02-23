import { useState, useRef, useEffect } from 'preact/hooks'

export function SearchBar({ query, onSearch, onSaveHistory, searchHistory, countries, selectedCountry, onCountryChange }) {
    const [isFocused, setIsFocused] = useState(false)
    const containerRef = useRef(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsFocused(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
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

    return (
        <div class="search-container" ref={containerRef}>
            <div class="search-input-wrapper">
                <input
                    type="text"
                    class="search-input"
                    placeholder="Search by product, company, or reason... (Press Enter to save to history)"
                    value={query}
                    onInput={(e) => onSearch(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onKeyDown={handleKeyDown}
                />

                {isFocused && searchHistory && searchHistory.length > 0 && (
                    <ul class="search-history-dropdown">
                        {searchHistory.map((item, index) => (
                            <li
                                key={index}
                                class="search-history-item"
                                onMouseDown={(e) => {
                                    // Prevent input blur before click registers
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

            {countries && countries.length > 1 && (
                <select
                    class="country-select"
                    value={selectedCountry}
                    onChange={(e) => onCountryChange(e.target.value)}
                >
                    {countries.map(country => (
                        <option key={country} value={country}>
                            {country === 'All' ? 'All Countries' : country}
                        </option>
                    ))}
                </select>
            )}
        </div>
    )
}
