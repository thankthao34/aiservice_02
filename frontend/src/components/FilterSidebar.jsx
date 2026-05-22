export default function FilterSidebar({
  filters,
  setFilters,
  mainCategories = [],
  subCategories = []
}) {
  const handleMainCategoryChange = (value) => {
    setFilters((prev) => ({
      ...prev,
      mainCategory: value,
      subCategory: ''
    }));
  };

  return (
    <aside className="card filter-panel">
      <h3>Filter</h3>
      <label>
        Main Category
        <select
          value={filters.mainCategory}
          onChange={(e) => handleMainCategoryChange(e.target.value)}
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
          onChange={(e) => setFilters((prev) => ({
            ...prev,
            subCategory: e.target.value
          }))}
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
    </aside>
  );
}
