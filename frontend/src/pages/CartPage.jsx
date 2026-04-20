import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPriceVndFromUsd } from '../utils/currency';

export default function CartPage() {
  const { items, updateQty, total } = useCart();

  return (
    <section className="card">
      <h1>Your Cart</h1>
      {!items.length && <p>Cart is empty.</p>}
      {items.map((it) => (
        <div className="cart-item" key={it.id}>
          <div>
            <strong>{it.name}</strong>
            <p>{formatPriceVndFromUsd(it.price)} x {it.quantity}</p>
          </div>
          <input type="number" min={0} value={it.quantity} onChange={(e) => updateQty(it.id, Number(e.target.value))} />
        </div>
      ))}
      <h2>Total: {formatPriceVndFromUsd(total)}</h2>
      <Link to="/checkout" className="btn neon">Go Checkout</Link>
    </section>
  );
}
