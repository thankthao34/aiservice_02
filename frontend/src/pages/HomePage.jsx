import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import FilterSidebar from '../components/FilterSidebar';
import CartDrawer from '../components/CartDrawer';
import { productService } from '../services/productService';
import { thousandVndToUsd } from '../utils/currency';
import { getSubcategoriesByMain, normalizeCategoryPayload } from '../utils/categoryTree';

const SEARCH_HISTORY_KEY = 'nexus_search_history';
const MAX_SEARCH_HISTORY = 5;

export default function HomePage() {
  const [filters, setFilters] = useState({ mainCategory: '', subCategory: '', minPrice: '', maxPrice: '', search: '' });
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [taxonomy, setTaxonomy] = useState({ tree: [], flat: [] });
  const [searchHistory, setSearchHistory] = useState([]);

  const mainCategories = taxonomy.tree || [];
  const subCategories = filters.mainCategory
    ? getSubcategoriesByMain(mainCategories, filters.mainCategory)
    : [];

  useEffect(() => {
    const queryFilters = {
      mainCategory: filters.mainCategory,
      subCategory: filters.subCategory,
      category: filters.subCategory,
      search: filters.search,
      minPrice: filters.minPrice ? thousandVndToUsd(filters.minPrice) : '',
      maxPrice: filters.maxPrice ? thousandVndToUsd(filters.maxPrice) : ''
    };
    productService.list(queryFilters).then((res) => setProducts(res.data));
  }, [filters]);

  useEffect(() => {
    productService.featured().then((res) => setFeatured(res.data));
    productService
      .categories()
      .then((res) => setTaxonomy(normalizeCategoryPayload(res.data)))
      .catch(() => setTaxonomy({ tree: [], flat: [] }));

    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY) || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSearchHistory(parsed.slice(0, MAX_SEARCH_HISTORY));
      }
    } catch {
      setSearchHistory([]);
    }
  }, []);

  const handleSearchSubmit = (rawTerm) => {
    const term = String(rawTerm || '').trim();
    localStorage.setItem('nexus_last_search_query', term);
    if (term.length < 2) return;

    setSearchHistory((prev) => {
      const next = [term, ...prev.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX_SEARCH_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <section>
      <div className="hero card">
        <p className="chip">NOIR TECH EXPERIENCE</p>
        <h1>AI-Powered E-commerce cho tuong lai mua sam</h1>
        <p>
          Kham pha san pham, duoc phan loai hanh vi bang Deep Learning va tu van thong minh boi RAG Chatbot.
        </p>
        <p>Tuong thich trinh bay kieu Shopee voi {taxonomy.flat.length || 13}+ danh muc san pham.</p>
      </div>

      <div className="layout-grid">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          mainCategories={mainCategories}
          subCategories={subCategories}
          searchHistory={searchHistory}
          onSearchSubmit={handleSearchSubmit}
        />
        <div>
          <h2>All Products</h2>
          <div className="products-grid">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
        <CartDrawer />
      </div>

      <h2>AI Picks For You</h2>
      <div className="products-grid">
        {featured.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
