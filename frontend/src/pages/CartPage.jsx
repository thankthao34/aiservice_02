import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPriceVndFromUsd } from '../utils/currency';

export default function CartPage() {
  const { items, updateQty, total } = useCart();

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
                <button type="button" className="btn-ghost small" aria-label={`Remove ${it.name}`} onClick={() => updateQty(it.id, 0)}>🗑️</button>
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
    </section>
  );
}
