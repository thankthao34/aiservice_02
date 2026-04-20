import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { formatPriceVndFromUsd } from '../utils/currency';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();

  return (
    <article className="card product-card">
      <img src={product.image_url} alt={product.name} className="product-thumb" />
      <div className="product-meta">
        <p className="category">{product.category}</p>
        <h3>{product.name}</h3>
        <p className="desc">{product.description}</p>
        <div className="row">
          <strong>{formatPriceVndFromUsd(product.price)}</strong>
          <span>{product.rating} / 5</span>
        </div>
        <div className="row tiny-meta">
          <span>Ton kho: {product.stock}</span>
          <span>{product.review_count || 0} danh gia</span>
        </div>
      </div>
      <div className="row actions">
        <Link className="btn ghost" to={`/product/${product.id}`}>Detail</Link>
        <button className="btn neon" onClick={() => addToCart(product, 1)}>Add</button>
      </div>
    </article>
  );
}
