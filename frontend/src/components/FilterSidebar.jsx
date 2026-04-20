export default function FilterSidebar({
  filters,
  setFilters,
  mainCategories = [],
  subCategories = [],
  searchHistory = [],
  onSearchSubmit = () => {}
}) {
  return (
    <aside className="card filter-panel">
      <h3>Filter</h3>
      <label>
        Main Category
        <select
          value={filters.mainCategory}
          onChange={(e) => setFilters({ ...filters, mainCategory: e.target.value, subCategory: '' })}
        >
          <option value="">All</option>
          {mainCategories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </label>
      <label>
        Sub Category
        <select
          value={filters.subCategory}
          disabled={!filters.mainCategory}
          onChange={(e) => setFilters({ ...filters, subCategory: e.target.value })}
        >
          <option value="">{filters.mainCategory ? 'All' : 'Select main category first'}</option>
          {subCategories.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </label>
      <label>
        Min Price (nghin dong)
        <input type="number" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} placeholder="VD: 5000" />
      </label>
      <label>
        Max Price (nghin dong)
        <input type="number" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder="VD: 20000" />
      </label>
      <label>
        Search
        <input
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSearchSubmit(e.currentTarget.value);
            }
          }}
        />
        {!!searchHistory.length && (
          <div className="search-history">
            <small>Lich su tim kiem</small>
            <div className="search-history-list">
              {searchHistory.slice(0, 5).map((term) => (
                <button
                  type="button"
                  key={term}
                  className="search-history-item"
                  onClick={() => {
                    setFilters({ ...filters, search: term });
                    onSearchSubmit(term);
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}
      </label>
    </aside>
  );
}
