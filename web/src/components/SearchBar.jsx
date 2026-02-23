export function SearchBar({ query, onSearch }) {
    return (
        <div class="search-container">
            <input
                type="text"
                class="search-input"
                placeholder="Search by product, company, or reason..."
                value={query}
                onInput={(e) => onSearch(e.target.value)}
            />
        </div>
    )
}
