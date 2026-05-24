import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { orderService } from '../services/orderService';
import { userService } from '../services/userService';
import { formatPriceVndFromUsd } from '../utils/currency';

const initialAddress = {
  receiver_name: '',
  phone: '',
  line1: '',
  ward: '',
  district: '',
  city: '',
  note: ''
};

export default function CheckoutPage() {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [addressForm, setAddressForm] = useState(initialAddress);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const navigate = useNavigate();

  const shippingFee = useMemo(() => (items.length ? 1.5 : 0), [items.length]);
  const grandTotal = useMemo(() => total + shippingFee, [total, shippingFee]);

  const loadAddresses = async () => {
    if (!user) return;
    const { data } = await userService.addresses(user.id);
    setAddresses(data);
    const defaultAddress = data.find((a) => Number(a.is_default) === 1) || data[0] || null;
    setSelectedAddressId(defaultAddress?.id || null);
  };

  useEffect(() => {
    loadAddresses().catch(() => setAddresses([]));
  }, [user]);

  const selectedAddress = useMemo(
    () => addresses.find((a) => a.id === Number(selectedAddressId)) || null,
    [addresses, selectedAddressId]
  );

  const onAddAddress = async (e) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      ...addressForm,
      is_default: addresses.length === 0
    };
    await userService.addAddress(user.id, payload);
    setAddressForm(initialAddress);
    setShowAddressForm(false);
    await loadAddresses();
  };

  const setDefault = async (addressId) => {
    if (!user) return;
    await userService.setDefaultAddress(user.id, addressId);
    await loadAddresses();
  };

  const onPay = async () => {
    if (!items.length || !user || !selectedAddress) return;
    setLoading(true);
    try {
      const { data: order } = await orderService.create({
        user_id: user.id,
        items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        shipping: {
          receiver_name: selectedAddress.receiver_name,
          phone: selectedAddress.phone,
          line1: selectedAddress.line1,
          ward: selectedAddress.ward,
          district: selectedAddress.district,
          city: selectedAddress.city,
          note: selectedAddress.note
        }
      });
      await orderService.pay(order.id);
      clearCart();
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="checkout-layout">
      <article className="card checkout-main-panel">
        <h1>Địa chỉ nhận hàng</h1>
        {!addresses.length && <p>Bạn chưa có địa chỉ. Vui lòng thêm mới trước khi thanh toán.</p>}

        {!!addresses.length && (
          <div className="address-list">
            {addresses.map((addr) => (
              <label className="address-card" key={addr.id}>
                <input
                  type="radio"
                  checked={Number(selectedAddressId) === addr.id}
                  onChange={() => setSelectedAddressId(addr.id)}
                />
                <div>
                  <div className="row">
                    <strong>{addr.receiver_name}</strong>
                    {Number(addr.is_default) === 1 && <span className="chip">Mặc định</span>}
                  </div>
                  <p>{addr.phone}</p>
                  <p>{addr.line1}, {addr.ward}, {addr.district}, {addr.city}</p>
                  {addr.note && <small>Ghi chú: {addr.note}</small>}
                  {Number(addr.is_default) !== 1 && (
                    <button className="btn ghost" type="button" onClick={() => setDefault(addr.id)}>Đặt mặc định</button>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <button className="btn ghost checkout-address-toggle" onClick={() => setShowAddressForm((v) => !v)}>
          {showAddressForm ? 'Đóng form' : 'Thêm địa chỉ mới'}
        </button>

        {showAddressForm && (
          <form className="address-form checkout-address-form" onSubmit={onAddAddress}>
            <input required placeholder="Người nhận" value={addressForm.receiver_name} onChange={(e) => setAddressForm((p) => ({ ...p, receiver_name: e.target.value }))} />
            <input required placeholder="Số điện thoại" value={addressForm.phone} onChange={(e) => setAddressForm((p) => ({ ...p, phone: e.target.value }))} />
            <input required placeholder="Địa chỉ cụ thể" value={addressForm.line1} onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))} />
            <input placeholder="Phường/Xã" value={addressForm.ward} onChange={(e) => setAddressForm((p) => ({ ...p, ward: e.target.value }))} />
            <input placeholder="Quận/Huyện" value={addressForm.district} onChange={(e) => setAddressForm((p) => ({ ...p, district: e.target.value }))} />
            <input required placeholder="Tỉnh/Thành phố" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} />
            <input placeholder="Ghi chú" value={addressForm.note} onChange={(e) => setAddressForm((p) => ({ ...p, note: e.target.value }))} />
            <button className="btn neon" type="submit">Lưu địa chỉ</button>
          </form>
        )}
      </article>

      <article className="card checkout-summary-panel">
        <h1>Thông tin đơn hàng</h1>
        <p className="checkout-summary-note">Kiểm tra lại sản phẩm, số lượng và tổng tiền trước khi đặt hàng.</p>

        {!items.length && <p>Giỏ hàng đang trống.</p>}
        <div className="checkout-items">
          {items.map((it) => (
            <div className="checkout-order-item" key={it.id}>
              <img
                className="checkout-order-thumb"
                src={it.image_url || 'https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&w=240&q=80'}
                alt={it.name}
              />
              <div className="checkout-order-meta">
                <strong>{it.name}</strong>
                <span>{it.category} · Số lượng: {it.quantity}</span>
              </div>
              <div className="checkout-order-price">{formatPriceVndFromUsd(it.price * it.quantity)}</div>
            </div>
          ))}
        </div>

        <div className="checkout-summary">
          <div className="row"><span>Tạm tính</span><strong>{formatPriceVndFromUsd(total)}</strong></div>
          <div className="row"><span>Phí vận chuyển</span><strong>{formatPriceVndFromUsd(shippingFee)}</strong></div>
          <div className="row total-row"><span>Tổng thanh toán</span><strong>{formatPriceVndFromUsd(grandTotal)}</strong></div>
        </div>

        <button
          className="btn neon checkout-pay-btn"
          onClick={onPay}
          disabled={loading || !items.length || !selectedAddress}
        >
          {loading ? 'Đang xử lý...' : 'Đặt hàng và thanh toán'}
        </button>
      </article>
    </section>
  );
}
