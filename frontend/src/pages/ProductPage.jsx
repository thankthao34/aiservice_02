import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatPriceVndFromUsd } from '../utils/currency';

const STAR_OPTIONS = [1, 2, 3, 4, 5];

export default function ProductPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const infoRows = useMemo(() => {
    if (!product) return [];
    return [
      { label: 'Danh muc', value: product.basic_info?.category || product.category },
      { label: 'Thuong hieu', value: product.basic_info?.brand || 'Dang cap nhat' },
      { label: 'Bao hanh', value: `${product.basic_info?.warranty_months || 12} thang` },
      { label: 'Ton kho', value: product.basic_info?.stock ?? product.stock }
    ];
  }, [product]);

  const loadData = async () => {
    const [productRes, reviewRes] = await Promise.all([
      productService.detail(id),
      productService.reviews(id)
    ]);
    setProduct(productRes.data);
    setReviews(reviewRes.data);

    if (user) {
      const { data } = await orderService.canReview(user.id, id);
      setCanReview(Boolean(data.canReview));
      setOrderId(data.order_id || null);
    } else {
      setCanReview(false);
      setOrderId(null);
    }
  };

  useEffect(() => {
    loadData().catch(() => {
      setProduct(null);
      setReviews([]);
    });
  }, [id, user]);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user || !canReview || !orderId) return;
    setSubmitting(true);
    try {
      await productService.addReview(id, {
        user_id: user.id,
        user_name: user.name,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        order_id: orderId
      });
      setReviewForm({ rating: 5, comment: '' });
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return <p>Loading...</p>;

  return (
    <section className="detail-stack">
      <article className="card detail-page">
        <img src={product.image_url} alt={product.name} className="detail-thumb" />
        <div>
          <p className="chip">{product.category}</p>
          <h1>{product.name}</h1>
          <p>{product.description}</p>

          <div className="basic-info-grid">
            {infoRows.map((row) => (
              <div key={row.label} className="basic-info-item">
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>

          <p>Danh gia trung binh: {product.avg_rating} / 5 ({product.review_count || 0} danh gia)</p>
          <h3>{formatPriceVndFromUsd(product.price)}</h3>
          <button className="btn neon" onClick={() => addToCart(product, 1)}>Them vao gio</button>
        </div>
      </article>

      <article className="card">
        <h2>Danh gia san pham</h2>
        {!reviews.length && <p>Chua co danh gia nao.</p>}
        {reviews.map((r) => (
          <div className="review-item" key={r.id}>
            <div className="row">
              <strong>{r.user_name}</strong>
              <span>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            </div>
            <p>{r.comment}</p>
            <small>Don hang #{r.order_id} - {r.created_at}</small>
          </div>
        ))}

        {!user && <p>Dang nhap va mua hang de co the danh gia.</p>}
        {user && !canReview && <p>Ban chi duoc danh gia sau khi da mua va don o trang thai hoan thanh.</p>}

        {user && canReview && (
          <form className="review-form" onSubmit={submitReview}>
            <h3>Viet danh gia cua ban</h3>
            <label>
              So sao
              <select
                value={reviewForm.rating}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
              >
                {STAR_OPTIONS.map((s) => <option value={s} key={s}>{s} sao</option>)}
              </select>
            </label>
            <label>
              Noi dung
              <textarea
                rows={3}
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
                placeholder="Cam nhan cua ban sau khi su dung san pham..."
                required
              />
            </label>
            <button className="btn neon" disabled={submitting} type="submit">
              {submitting ? 'Dang gui...' : 'Gui danh gia'}
            </button>
          </form>
        )}
      </article>
    </section>
  );
}
