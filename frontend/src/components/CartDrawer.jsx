import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPriceVndFromUsd } from '../utils/currency';

export default function CartDrawer() {
  const { items, total } = useCart();

  return (
    <section className="card">
      <h3>Quick Cart</h3>
      <p>{items.length} products</p>
      <p>Total: {formatPriceVndFromUsd(total)}</p>
      <Link className="btn neon" to="/cart">Open Cart</Link>
    </section>
  );
}
