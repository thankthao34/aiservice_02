import { useEffect, useMemo, useState } from 'react';
import { productService } from '../services/productService';
import { userService } from '../services/userService';
import { orderService } from '../services/orderService';
import { formatPriceVndFromUsd } from '../utils/currency';
import { getSubcategoriesByMain, normalizeCategoryPayload } from '../utils/categoryTree';

const ADMIN_TABS = {
  products: 'Quan ly san pham',
  customers: 'Quan ly khach hang',
  orders: 'Quan ly order',
  reviews: 'Quan ly review'
};

const PAGE_SIZE = {
  products: 8,
  customers: 8,
  orders: 8,
  reviews: 10
};

const initialProduct = {
  name: '',
  main_category: 'electronics',
  sub_category: 'phone',
  category: 'phone',
  price: 100,
  stock: 10,
  brand: '',
  warranty_months: 12,
  image_url: '',
  description: ''
};

const initialUser = {
  name: '',
  email: '',
  password: '',
  role: 'customer'
};

const initialFilters = {
  products: { search: '', mainCategory: '', subCategory: '', minPrice: '', maxPrice: '', stock: 'all' },
  customers: { search: '', role: 'all' },
  orders: { status: 'all', userId: '', minTotal: '' },
  reviews: { search: '', minRating: 'all' }
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('products');
  const [taxonomy, setTaxonomy] = useState({ tree: [], flat: [] });

  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState(initialProduct);

  const [customers, setCustomers] = useState([]);
  const [userForm, setUserForm] = useState(initialUser);

  const [orders, setOrders] = useState([]);
  const [allProductReviews, setAllProductReviews] = useState([]);

  const [filters, setFilters] = useState(initialFilters);
  const [pages, setPages] = useState({ products: 1, customers: 1, orders: 1, reviews: 1 });

  const [uploadFiles, setUploadFiles] = useState({});
  const [uploadingId, setUploadingId] = useState(null);

  const setFilter = (tab, key, value) => {
    setFilters((prev) => ({
      ...prev,
      [tab]: {
        ...prev[tab],
        [key]: value
      }
    }));
    setPages((prev) => ({ ...prev, [tab]: 1 }));
  };

  const setPage = (tab, nextPage) => {
    setPages((prev) => ({ ...prev, [tab]: nextPage }));
  };

  const sliceByPage = (tab, rows) => {
    const size = PAGE_SIZE[tab];
    const page = pages[tab] || 1;
    const start = (page - 1) * size;
    return rows.slice(start, start + size);
  };

  const totalPages = (tab, rows) => Math.max(1, Math.ceil(rows.length / PAGE_SIZE[tab]));

  const load = async () => {
    const [categoriesRes, productsRes, usersRes, ordersRes] = await Promise.all([
      productService.categories(),
      productService.adminList(),
      userService.adminListUsers(),
      orderService.adminOrders()
    ]);

    setTaxonomy(normalizeCategoryPayload(categoriesRes.data));
    setProducts(productsRes.data);
    setCustomers(usersRes.data);
    setOrders(ordersRes.data);

    const reviewResponses = await Promise.all(
      productsRes.data.map((p) =>
        productService
          .reviews(p.id)
          .then((r) => ({ product: p, reviews: r.data }))
          .catch(() => ({ product: p, reviews: [] }))
      )
    );

    const reviews = reviewResponses.flatMap((entry) =>
      entry.reviews.map((rv) => ({ ...rv, product_name: entry.product.name, product_id: entry.product.id }))
    );

    setAllProductReviews(reviews.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
  };

  useEffect(() => {
    load().catch(() => {
      setProducts([]);
      setCustomers([]);
      setOrders([]);
      setAllProductReviews([]);
    });
  }, []);

  const mainCategories = useMemo(() => taxonomy.tree || [], [taxonomy]);
  const formSubCategories = useMemo(
    () => getSubcategoriesByMain(mainCategories, productForm.main_category),
    [mainCategories, productForm.main_category]
  );
  const filterSubCategories = useMemo(
    () => (filters.products.mainCategory
      ? getSubcategoriesByMain(mainCategories, filters.products.mainCategory)
      : taxonomy.flat || []),
    [mainCategories, taxonomy.flat, filters.products.mainCategory]
  );

  useEffect(() => {
    if (!mainCategories.length) return;

    setProductForm((prev) => {
      const currentMain = mainCategories.some((cat) => cat.key === prev.main_category)
        ? prev.main_category
        : mainCategories[0].key;
      const currentSubs = getSubcategoriesByMain(mainCategories, currentMain);
      const currentSub = currentSubs.some((sub) => sub.key === prev.sub_category)
        ? prev.sub_category
        : (currentSubs[0]?.key || '');

      if (prev.main_category === currentMain && prev.sub_category === currentSub && prev.category === currentSub) {
        return prev;
      }

      return {
        ...prev,
        main_category: currentMain,
        sub_category: currentSub,
        category: currentSub
      };
    });
  }, [mainCategories]);

  const filteredProducts = useMemo(() => {
    const f = filters.products;
    const search = String(f.search || '').trim().toLowerCase();
    const minPrice = f.minPrice === '' ? null : Number(f.minPrice);
    const maxPrice = f.maxPrice === '' ? null : Number(f.maxPrice);

    return products.filter((p) => {
      const productMain = p.main_category || '';
      const productSub = p.sub_category || p.category || '';
      if (f.mainCategory && productMain !== f.mainCategory) return false;
      if (f.subCategory && productSub !== f.subCategory) return false;
      if (f.stock === 'instock' && Number(p.stock) <= 0) return false;
      if (f.stock === 'low' && Number(p.stock) > 5) return false;
      if (Number.isFinite(minPrice) && Number(p.price) < minPrice) return false;
      if (Number.isFinite(maxPrice) && Number(p.price) > maxPrice) return false;
      if (search) {
        const hay = `${p.name} ${p.description || ''} ${p.brand || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [products, filters.products]);

  const filteredCustomers = useMemo(() => {
    const f = filters.customers;
    const search = String(f.search || '').trim().toLowerCase();
    return customers.filter((u) => {
      if (f.role !== 'all' && u.role !== f.role) return false;
      if (!search) return true;
      return `${u.name} ${u.email}`.toLowerCase().includes(search);
    });
  }, [customers, filters.customers]);

  const filteredOrders = useMemo(() => {
    const f = filters.orders;
    const userId = f.userId === '' ? null : Number(f.userId);
    const minTotal = f.minTotal === '' ? null : Number(f.minTotal);
    return orders.filter((o) => {
      if (f.status !== 'all' && o.status !== f.status) return false;
      if (Number.isFinite(userId) && Number(o.user_id) !== userId) return false;
      if (Number.isFinite(minTotal) && Number(o.total) < minTotal) return false;
      return true;
    });
  }, [orders, filters.orders]);

  const filteredReviews = useMemo(() => {
    const f = filters.reviews;
    const search = String(f.search || '').trim().toLowerCase();
    return allProductReviews.filter((r) => {
      if (f.minRating !== 'all' && Number(r.rating) < Number(f.minRating)) return false;
      if (!search) return true;
      return `${r.user_name} ${r.product_name} ${r.comment}`.toLowerCase().includes(search);
    });
  }, [allProductReviews, filters.reviews]);

  const pagedProducts = useMemo(() => sliceByPage('products', filteredProducts), [filteredProducts, pages.products]);
  const pagedCustomers = useMemo(() => sliceByPage('customers', filteredCustomers), [filteredCustomers, pages.customers]);
  const pagedOrders = useMemo(() => sliceByPage('orders', filteredOrders), [filteredOrders, pages.orders]);
  const pagedReviews = useMemo(() => sliceByPage('reviews', filteredReviews), [filteredReviews, pages.reviews]);

  const createProduct = async (e) => {
    e.preventDefault();
    await productService.adminCreate(productForm);
    setProductForm(initialProduct);
    await load();
  };

  const uploadProductImage = async (productId) => {
    const file = uploadFiles[productId];
    if (!file) return;

    setUploadingId(productId);
    try {
      await productService.adminUploadImage(productId, file);
      setUploadFiles((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      await load();
    } finally {
      setUploadingId(null);
    }
  };

  const deleteProduct = async (id) => {
    await productService.adminDelete(id);
    await load();
  };

  const createUser = async (e) => {
    e.preventDefault();
    await userService.adminCreateUser(userForm);
    setUserForm(initialUser);
    await load();
  };

  const deleteUser = async (id) => {
    await userService.adminDeleteUser(id);
    await load();
  };

  const updateOrderStatus = async (id, status) => {
    await orderService.adminUpdateStatus(id, status);
    await load();
  };

  const deleteReview = async (reviewId) => {
    await productService.adminDeleteReview(reviewId);
    await load();
  };

  const renderPagination = (tab, rows) => {
    const current = pages[tab] || 1;
    const total = totalPages(tab, rows);
    return (
      <div className="admin-pagination">
        <button className="btn ghost" disabled={current <= 1} onClick={() => setPage(tab, current - 1)}>Prev</button>
        <span>Page {current}/{total} ({rows.length} items)</span>
        <button className="btn ghost" disabled={current >= total} onClick={() => setPage(tab, current + 1)}>Next</button>
      </div>
    );
  };

  return (
    <section className="admin-shell">
      <article className="card admin-hero">
        <h1>Admin Center</h1>
      </article>

      <article className="card tab-shell">
        <div className="tab-nav">
          {Object.entries(ADMIN_TABS).map(([key, label]) => (
            <button key={key} className={`btn ${activeTab === key ? 'neon' : 'ghost'}`} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </div>

        {activeTab === 'products' && (
          <div>
            <h2>CRUD san pham + Upload anh</h2>
            <form className="admin-form" onSubmit={createProduct}>
              <input required placeholder="Ten san pham" value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} />
              <select
                value={productForm.main_category}
                onChange={(e) => {
                  const nextMain = e.target.value;
                  const nextSubs = getSubcategoriesByMain(mainCategories, nextMain);
                  const nextSub = nextSubs[0]?.key || '';
                  setProductForm((p) => ({ ...p, main_category: nextMain, sub_category: nextSub, category: nextSub }));
                }}
              >
                {mainCategories.map((main) => <option value={main.key} key={main.key}>{main.label}</option>)}
              </select>
              <select
                value={productForm.sub_category}
                onChange={(e) => {
                  const nextSub = e.target.value;
                  setProductForm((p) => ({ ...p, sub_category: nextSub, category: nextSub }));
                }}
              >
                {formSubCategories.map((sub) => <option value={sub.key} key={sub.key}>{sub.label}</option>)}
              </select>
              <input required type="number" placeholder="Gia" value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: Number(e.target.value) }))} />
              <input required type="number" placeholder="Ton kho" value={productForm.stock} onChange={(e) => setProductForm((p) => ({ ...p, stock: Number(e.target.value) }))} />
              <input placeholder="Thuong hieu" value={productForm.brand} onChange={(e) => setProductForm((p) => ({ ...p, brand: e.target.value }))} />
              <input type="number" placeholder="Bao hanh (thang)" value={productForm.warranty_months} onChange={(e) => setProductForm((p) => ({ ...p, warranty_months: Number(e.target.value) }))} />
              <input placeholder="Image URL (tuy chon)" value={productForm.image_url} onChange={(e) => setProductForm((p) => ({ ...p, image_url: e.target.value }))} />
              <input placeholder="Mo ta" value={productForm.description} onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))} />
              <button className="btn neon" type="submit">Them san pham</button>
            </form>

            <div className="admin-filters">
              <input placeholder="Tim theo ten/brand/mo ta" value={filters.products.search} onChange={(e) => setFilter('products', 'search', e.target.value)} />
              <select
                value={filters.products.mainCategory}
                onChange={(e) => {
                  setFilter('products', 'mainCategory', e.target.value);
                  setFilter('products', 'subCategory', '');
                }}
              >
                <option value="">Tat ca nganh hang</option>
                {mainCategories.map((main) => <option value={main.key} key={main.key}>{main.label}</option>)}
              </select>
              <select value={filters.products.subCategory} onChange={(e) => setFilter('products', 'subCategory', e.target.value)}>
                <option value="">Tat ca danh muc con</option>
                {filterSubCategories.map((sub) => <option value={sub.key} key={sub.key}>{sub.label}</option>)}
              </select>
              <input type="number" placeholder="Gia tu" value={filters.products.minPrice} onChange={(e) => setFilter('products', 'minPrice', e.target.value)} />
              <input type="number" placeholder="Gia den" value={filters.products.maxPrice} onChange={(e) => setFilter('products', 'maxPrice', e.target.value)} />
              <select value={filters.products.stock} onChange={(e) => setFilter('products', 'stock', e.target.value)}>
                <option value="all">Tat ca ton kho</option>
                <option value="instock">Con hang</option>
                <option value="low">Sap het (&lt;=5)</option>
              </select>
            </div>

            {renderPagination('products', filteredProducts)}
            <div className="table-list">
              {pagedProducts.map((p) => (
                <div className="table-row" key={p.id}>
                  <div className="table-main">
                    <img className="admin-thumb" src={p.image_url} alt={p.name} />
                    <div>
                      <strong>{p.name}</strong>
                      <p>{p.main_category || 'unknown'} / {p.sub_category || p.category} - {formatPriceVndFromUsd(p.price)} - Ton: {p.stock}</p>
                      <small>{p.brand}</small>
                    </div>
                  </div>
                  <div className="table-actions">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setUploadFiles((prev) => ({ ...prev, [p.id]: e.target.files?.[0] || null }))}
                    />
                    <button className="btn ghost" disabled={!uploadFiles[p.id] || uploadingId === p.id} onClick={() => uploadProductImage(p.id)}>
                      {uploadingId === p.id ? 'Dang upload...' : 'Upload anh'}
                    </button>
                    <button className="btn ghost" onClick={() => deleteProduct(p.id)}>Xoa</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div>
            <h2>CRUD khach hang</h2>
            <form className="admin-form" onSubmit={createUser}>
              <input required placeholder="Ten" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} />
              <input required type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
              <input required type="password" placeholder="Mat khau" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} />
              <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
                <option value="customer">customer</option>
                <option value="admin">admin</option>
              </select>
              <button className="btn neon" type="submit">Them tai khoan</button>
            </form>

            <div className="admin-filters">
              <input placeholder="Tim theo ten/email" value={filters.customers.search} onChange={(e) => setFilter('customers', 'search', e.target.value)} />
              <select value={filters.customers.role} onChange={(e) => setFilter('customers', 'role', e.target.value)}>
                <option value="all">Tat ca role</option>
                <option value="customer">customer</option>
                <option value="admin">admin</option>
              </select>
            </div>

            {renderPagination('customers', filteredCustomers)}
            <div className="table-list">
              {pagedCustomers.map((u) => (
                <div className="table-row" key={u.id}>
                  <div>
                    <strong>{u.name} ({u.role})</strong>
                    <p>{u.email}</p>
                  </div>
                  <button className="btn ghost" onClick={() => deleteUser(u.id)}>Xoa</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h2>Cap nhat trang thai order</h2>

            <div className="admin-filters">
              <select value={filters.orders.status} onChange={(e) => setFilter('orders', 'status', e.target.value)}>
                <option value="all">Tat ca status</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="shipping">shipping</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
              <input type="number" placeholder="Loc theo user_id" value={filters.orders.userId} onChange={(e) => setFilter('orders', 'userId', e.target.value)} />
              <input type="number" placeholder="Tong tien toi thieu (USD)" value={filters.orders.minTotal} onChange={(e) => setFilter('orders', 'minTotal', e.target.value)} />
            </div>

            {renderPagination('orders', filteredOrders)}
            <div className="table-list">
              {pagedOrders.map((o) => (
                <div className="table-row" key={o.id}>
                  <div>
                    <strong>Don #{o.id}</strong>
                    <p>User #{o.user_id} - {formatPriceVndFromUsd(o.total)} - {o.status}</p>
                  </div>
                  <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="shipping">shipping</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div>
            <h2>Quan ly review (xoa review khong hop le)</h2>

            <div className="admin-filters">
              <input placeholder="Tim user/san pham/noi dung" value={filters.reviews.search} onChange={(e) => setFilter('reviews', 'search', e.target.value)} />
              <select value={filters.reviews.minRating} onChange={(e) => setFilter('reviews', 'minRating', e.target.value)}>
                <option value="all">Tat ca sao</option>
                <option value="5">Tu 5 sao</option>
                <option value="4">Tu 4 sao</option>
                <option value="3">Tu 3 sao</option>
                <option value="2">Tu 2 sao</option>
                <option value="1">Tu 1 sao</option>
              </select>
            </div>

            {renderPagination('reviews', filteredReviews)}
            {!filteredReviews.length && <p>Chua co review phu hop bo loc.</p>}
            <div className="table-list">
              {pagedReviews.map((r) => (
                <div className="table-row" key={r.id}>
                  <div>
                    <strong>{r.user_name} - {r.product_name}</strong>
                    <p>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} - {r.comment}</p>
                    <small>Order #{r.order_id}</small>
                  </div>
                  <button className="btn ghost" onClick={() => deleteReview(r.id)}>Xoa</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
