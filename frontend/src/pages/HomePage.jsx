import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const queryFilters = {
      mainCategory: filters.mainCategory,
      subCategory: filters.subCategory,
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
  }, []);

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
        {/* <div className="hero-copy">
          <p className="chip">NOIR TECH EXPERIENCE</p>
          <h1>AI-Powered E-commerce cho tuong lai mua sam</h1>
          <div className="hero-badges">
            <span>Deep Learning</span>
            <span>RAG Chatbot</span>
            <span>{taxonomy.flat.length || 13}+ danh muc</span>
          </div>
          <p className="hero-note">
            Giao dien dinh huong san pham nhanh, giai phap goi y thong minh, va trai nghiem mua sam mang phong cach quang cao cao cap.
          </p>
        </div> */}
        {/* <div className="hero-banner" aria-label="Banner quảng cáo NEXUS Store"> */}
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
        {/* </div> */}
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
