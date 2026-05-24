import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { aiService } from '../services/aiService';
import { formatPriceVndFromUsd } from '../utils/currency';

export default function CartPage() {
  const { user } = useAuth();
  const { items, updateQty, total } = useCart();
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    let cancelled = false;

    if (!items.length) {
      setRecommendations([]);
      return () => {};
    }

    const timer = window.setTimeout(async () => {
      try {
        const usedIds = new Set(items.map((item) => item.id));
        const response = await Promise.all(items.map(async (item) => {
          const recRes = await aiService.recommend(user?.id || 0, {
            message: `Goi y san pham lien quan den ${item.name} (${item.category}) trong gio hang`,
            cartProductIds: [item.id],
            limit: 3
          });
          return recRes.data.products || [];
        }));

        const merged = [];
        for (const group of response) {
          for (const product of group) {
            if (!product || usedIds.has(product.id) || merged.some((item) => item.id === product.id)) continue;
            merged.push(product);
            if (merged.length >= 10) break;
          }
          if (merged.length >= 10) break;
        }

        if (!cancelled) {
          setRecommendations(merged);
        }
      } catch {
        if (!cancelled) setRecommendations([]);
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [items, user?.id]);

  return (
    <section className="cart-page container main-content">
      <h1>Your Cart</h1>
      {!items.length && <p>Cart is empty.</p>}

      <div className="cart-layout">
        <div className="cart-items">
          {items.map((it) => (
            <div className="cart-item" key={it.id}>
              <div className="cart-item-main">
                <img src={it.image_url} alt={it.name} className="cart-thumb" />
                <div className="cart-meta">
                  <strong className="cart-name">{it.name}</strong>
                  <div className="cart-price-small">{formatPriceVndFromUsd(it.price)}</div>
                </div>
              </div>

              <div className="cart-item-qty">
                <div className="qty-control" role="group" aria-label={`Quantity for ${it.name}`}>
                  <button type="button" className="qty-btn" onClick={() => updateQty(it.id, Math.max(0, it.quantity - 1))}>−</button>
                  <div className="qty-value">{it.quantity}</div>
                  <button type="button" className="qty-btn" onClick={() => updateQty(it.id, it.quantity + 1)}>+</button>
                </div>
              </div>

              <div className="cart-item-subtotal">
                {formatPriceVndFromUsd(it.price * it.quantity)}
              </div>

              <div className="cart-item-actions">
                <button type="button" className="btn-ghost small" aria-label={`Remove ${it.name}`} onClick={() => updateQty(it.id, 0)}>
                  <svg className="icon-trash" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M3 6h18v2H3V6zm2 3h14l-1 12H6L5 9zm5-6h4l1 2H9l1-2z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <aside className="order-summary card">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Items</span><span>{items.length}</span></div>
          <div className="summary-row"><span>Subtotal</span><strong>{formatPriceVndFromUsd(total)}</strong></div>
          <div className="summary-actions">
            <Link to="/checkout" className="btn neon btn-checkout">Go Checkout</Link>
          </div>
        </aside>
      </div>

      {!!items.length && (
        <section className="cart-recommendations">
          <div className="section-head">
            <div>
              <h2>Sản phẩm gợi ý cho giỏ hàng</h2>
              <p>Gợi ý được gộp từ các món đang có trong giỏ, thường hiển thị khoảng 10 món sau khi khử trùng lặp.</p>
            </div>
          </div>

          {!!recommendations.length ? (
            <div className="products-grid">
              {recommendations.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p className="cart-recommendations-empty">Chưa có gợi ý phù hợp, hệ thống sẽ tự cập nhật khi đủ dữ liệu.</p>
          )}
        </section>
      )}
    </section>
  );
}
