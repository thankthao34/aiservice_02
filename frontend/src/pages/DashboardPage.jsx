import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { aiService } from '../services/aiService';
import SegmentBadge from '../components/SegmentBadge';
import { formatPriceVndFromUsd } from '../utils/currency';
import { getCartItemsKey, getCartProductIdsKey } from '../utils/cartStorage';

const TABS = {
  orders: 'Don hang',
  purchased: 'Da mua',
  addresses: 'Dia chi',
  ai: 'Goi y AI'
};

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [purchased, setPurchased] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [reviewedByProduct, setReviewedByProduct] = useState({});

  const defaultAddress = useMemo(
    () => addresses.find((a) => Number(a.is_default) === 1) || null,
    [addresses]
  );

  const load = async () => {
    if (!user) return;

    const [profileRes, ordersRes, purchasedRes, addressRes, userReviewsRes] = await Promise.all([
      userService.getProfile(user.id),
      orderService.history(user.id),
      orderService.purchasedItems(user.id),
      userService.addresses(user.id),
      productService.userReviews(user.id)
    ]);

    setProfile(profileRes.data);
    setOrders(ordersRes.data);
    setPurchased(purchasedRes.data);
    setAddresses(addressRes.data);

    const reviewedMap = {};
    for (const review of userReviewsRes.data || []) {
      // key by order_id when available so each order can have its own review
      const mapKey = review.order_id ? `${review.order_id}` : `${review.product_id}`;
      reviewedMap[mapKey] = review;
    }
    setReviewedByProduct(reviewedMap);

    const recommendationQuery = '';
    const budgetUsd = profileRes.data?.avg_price ? Number(profileRes.data.avg_price) * 1.2 : undefined;
    let cartProductIds = [];
    try {
      const raw = localStorage.getItem(getCartProductIdsKey(user)) || '[]';
      const parsed = JSON.parse(raw);
      cartProductIds = Array.isArray(parsed) && parsed.length
        ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];

      if (!cartProductIds.length) {
        const rawItems = localStorage.getItem(getCartItemsKey(user)) || '[]';
        const items = JSON.parse(rawItems);
        if (Array.isArray(items)) {
          cartProductIds = items
            .map((item) => Number(item?.id))
            .filter((id) => Number.isFinite(id));
        }
      }
    } catch {
      cartProductIds = [];
    }

    try {
      const recRes = await aiService.recommend(user.id, {
        message: recommendationQuery,
        budgetUsd,
        cartProductIds,
        limit: 4
      });
      setSuggestions(recRes.data.products || []);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    load().catch(() => {
      setOrders([]);
      setPurchased([]);
      setAddresses([]);
      setSuggestions([]);
      setReviewedByProduct({});
    });
  }, [user]);

  const setDefaultAddress = async (addressId) => {
    await userService.setDefaultAddress(user.id, addressId);
    await load();
  };

  const removeAddress = async (addressId) => {
    await userService.deleteAddress(user.id, addressId);
    await load();
  };

  const submitPurchasedReview = async (item) => {
    const reviewKey = item.order_id ? `${item.order_id}` : `${item.product_id}`;
    const draft = reviewDrafts[reviewKey];
    if (!draft || !draft.comment) return;

    try {
      await productService.addReview(item.product_id, {
        user_id: user.id,
        user_name: user.name,
        rating: Number(draft.rating || 5),
        comment: draft.comment,
        order_id: item.order_id
      });

      setReviewDrafts((prev) => {
        const next = { ...prev };
        delete next[reviewKey];
        return next;
      });
      await load();
    } catch (error) {
      alert(error?.response?.data?.message || 'Khong the gui danh gia');
    }
  };

  if (!profile) return <p>Loading dashboard...</p>;

  return (
    <section className="dash-stack">
      <article className="card dashboard-header">
        <div>
          <h1>Tai khoan cua toi</h1>
          <p>{profile.name} - {profile.email}</p>
          <SegmentBadge segment={profile.segment} score={profile.segment_score} />
        </div>
        <div className="profile-metrics">
          <div><span>Da chi tieu</span><strong>{formatPriceVndFromUsd(profile.total_spent || 0)}</strong></div>
          <div><span>Gia tri TB</span><strong>{formatPriceVndFromUsd(profile.avg_price || 0)}</strong></div>
          <div><span>So don</span><strong>{profile.purchase_count}</strong></div>
          <div><span>Danh muc yeu thich</span><strong>{profile.fav_category}</strong></div>
        </div>
      </article>

      <article className="card tab-shell">
        <div className="tab-nav">
          {Object.entries(TABS).map(([key, label]) => (
            <button
              className={`btn ${activeTab === key ? 'neon' : 'ghost'}`}
              key={key}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'orders' && (
          <div>
            <h2>Tab xem tat ca don hang</h2>
            {!orders.length && <p>Ban chua co don hang nao.</p>}
            {orders.map((o) => (
              <div className="history-item order-history-row" key={o.id}>
                <div className="order-history-col order-history-id">
                  <strong>Đơn #{o.id}</strong>
                  <span className="chip">{o.status}</span>
                </div>

                <div className="order-history-col order-history-total">
                  <strong>{formatPriceVndFromUsd(o.total)}</strong>
                  <span>{o.created_at}</span>
                </div>

                <div className="order-history-col order-history-address">
                  <strong>{o.receiver_name}</strong>
                  <span>{o.receiver_phone}</span>
                  <span>{o.shipping_address}, {o.shipping_ward}, {o.shipping_district}, {o.shipping_city}</span>
                </div>

                <div className="order-history-col order-history-products">
                  {(o.items || []).map((item) => (
                    <div className="order-history-product" key={item.id}>
                      <span className="order-history-product-name">{item.product_name}</span>
                      <span className="order-history-product-meta">{item.product_category} · SL: {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'purchased' && (
          <div>
            <h2>Tab don da mua (hoan thanh)</h2>
            {!purchased.length && <p>Chua co don hoan thanh nao de danh gia.</p>}
            {purchased.map((item) => {
              const key = `${item.order_id}-${item.product_id}`;
              const reviewKey = item.order_id ? `${item.order_id}` : `${item.product_id}`;
              const draft = reviewDrafts[reviewKey] || { rating: 5, comment: '' };
              const reviewed = reviewedByProduct[reviewKey];
              return (
                <div className="history-item block-item" key={key}>
                  <div className="row">
                    <strong>{item.product_name}</strong>
                    <span>Don #{item.order_id}</span>
                  </div>
                  <p>{item.product_category} - {item.quantity} x {formatPriceVndFromUsd(item.price)}</p>
                  {reviewed ? (
                    <div className="review-inline">
                      <span className="chip">Da danh gia: {reviewed.rating} sao</span>
                      <input value={reviewed.comment || ''} readOnly />
                      <button className="btn ghost" disabled>Da gui</button>
                    </div>
                  ) : (
                    <div className="review-inline">
                      <select
                        value={draft.rating}
                        onChange={(e) => setReviewDrafts((prev) => ({
                          ...prev,
                          [reviewKey]: { ...draft, rating: Number(e.target.value) }
                        }))}
                      >
                        <option value={5}>5 sao</option>
                        <option value={4}>4 sao</option>
                        <option value={3}>3 sao</option>
                        <option value={2}>2 sao</option>
                        <option value={1}>1 sao</option>
                      </select>
                      <input
                        placeholder="Nhap danh gia cua ban"
                        value={draft.comment}
                        onChange={(e) => setReviewDrafts((prev) => ({
                          ...prev,
                          [reviewKey]: { ...draft, comment: e.target.value }
                        }))}
                      />
                      <button className="btn neon" onClick={() => submitPurchasedReview(item)}>Danh gia</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'addresses' && (
          <div>
            <h2>Quan ly dia chi nhan hang</h2>
            {!addresses.length && <p>Chua co dia chi nao.</p>}
            {defaultAddress && (
              <p className="default-address-line">
                Dia chi mac dinh: {defaultAddress.receiver_name} - {defaultAddress.line1}, {defaultAddress.ward}, {defaultAddress.district}, {defaultAddress.city}
              </p>
            )}
            {addresses.map((addr) => (
              <div key={addr.id} className="history-item block-item">
                <div className="row">
                  <strong>{addr.receiver_name} - {addr.phone}</strong>
                  {Number(addr.is_default) === 1 && <span className="chip">Mac dinh</span>}
                </div>
                <p>{addr.line1}, {addr.ward}, {addr.district}, {addr.city}</p>
                <div className="row">
                  {Number(addr.is_default) !== 1 && (
                    <button className="btn ghost" onClick={() => setDefaultAddress(addr.id)}>Dat mac dinh</button>
                  )}
                  <button className="btn ghost" onClick={() => removeAddress(addr.id)}>Xoa</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ai' && (
          <div>
            <h2>AI Recommendations</h2>
            {!suggestions.length && <p>AI suggestions will appear after purchases.</p>}
            {suggestions.map((p) => (
              <div
                className="history-item block-item"
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/product/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/product/${p.id}`);
                  }
                }}
              >
                <strong>{p.name}</strong>
                <p>{formatPriceVndFromUsd(p.price)} - Xem chi tiet</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
