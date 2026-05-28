import { useEffect, useState, useRef } from 'react';
import ProductCard from '../components/ProductCard';
import FilterSidebar from '../components/FilterSidebar';
import CartDrawer from '../components/CartDrawer';
import { productService } from '../services/productService';
import { thousandVndToUsd } from '../utils/currency';
import { getSubcategoriesByMain, normalizeCategoryPayload } from '../utils/categoryTree';

export default function HomePage() {
  const [filters, setFilters] = useState({ mainCategory: '', subCategory: '', minPrice: '', maxPrice: '', search: '' });
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [taxonomy, setTaxonomy] = useState({ tree: [], flat: [] });

  const mainCategories = taxonomy.tree || [];
  const subCategories = filters.mainCategory
    ? getSubcategoriesByMain(mainCategories, filters.mainCategory)
    : [];
  const requestIdRef = useRef(0);

  useEffect(() => {
    const queryFilters = {
      mainCategory: filters.mainCategory,
      subCategory: filters.subCategory,
      search: filters.search,
      minPrice: filters.minPrice ? thousandVndToUsd(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? thousandVndToUsd(filters.maxPrice) : undefined
    };

    let cancelled = false;
    const currentRequestId = (requestIdRef.current += 1);
    const doFetch = () => {
      productService
        .list(queryFilters)
        .then((res) => {
          console.log('productService.list response', { queryFilters, length: Array.isArray(res.data) ? res.data.length : 0 });
          if (!cancelled && currentRequestId === requestIdRef.current) setProducts(res.data || []);
        })
        .catch((err) => {
          console.error('Failed to load products', err);
          if (!cancelled && currentRequestId === requestIdRef.current) setProducts([]);
        });
    };

    // debounce calls to avoid rapid re-renders from filter changes
    const timer = setTimeout(doFetch, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters]);

  useEffect(() => {
    productService.featured().then((res) => setFeatured(res.data || [])).catch((e) => { console.error('featured load failed', e); setFeatured([]); });
    productService
      .categories()
      .then((res) => setTaxonomy(normalizeCategoryPayload(res.data)))
      .catch((e) => { console.error('categories load failed', e); setTaxonomy({ tree: [], flat: [] }); });
  }, []);

  useEffect(() => {
    try {
      window.__NEXUS_PRODUCTS = products || [];
      console.log('window.__NEXUS_PRODUCTS set', products?.length || 0);
    } catch (e) {
      /* ignore */
    }
  }, [products]);

  useEffect(() => {
    const handleExternalSearch = (event) => {
      const term = String(event.detail || '').trim();
      setFilters((prev) => ({ ...prev, search: term }));
    };

    window.addEventListener('nexus-search-submit', handleExternalSearch);
    return () => window.removeEventListener('nexus-search-submit', handleExternalSearch);
  }, []);

  return (
    <section>
      <div className="hero card hero-split">
        <div className="hero-banner-main">
          <img
            src="https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80"
            alt="Banner quảng cáo mua sắm công nghệ"
          />
          <div className="hero-banner-overlay">
            <span>Summer Drop</span>
            <strong>Flash Deals</strong>
            <small>Đa dạng các mặt hàng Công nghệ, thời trang, sách, mỹ phẩm và đồ gia dụng,....</small>
          </div>
        </div>
        <div className="hero-banner-strip">
          <img
            src="https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=600&q=80"
            alt="Banner sản phẩm thời trang"
          />
          <img
            src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80"
            alt="Banner sản phẩm làm đẹp"
          />
          <img
            src="https://images.unsplash.com/photo-1556741533-6e6a62bd8b49?auto=format&fit=crop&w=600&q=80"
            alt="Banner sản phẩm gia dụng"
          />
        </div>
      </div>

      <div className="layout-grid">
        <FilterSidebar
          filters={filters}
          setFilters={setFilters}
          mainCategories={mainCategories}
          subCategories={subCategories}
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
