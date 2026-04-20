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
      <article className="card">
        <h1>Dia chi nhan hang</h1>
        {!addresses.length && <p>Ban chua co dia chi. Vui long them moi truoc khi thanh toan.</p>}

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
                    {Number(addr.is_default) === 1 && <span className="chip">Mac dinh</span>}
                  </div>
                  <p>{addr.phone}</p>
                  <p>{addr.line1}, {addr.ward}, {addr.district}, {addr.city}</p>
                  {addr.note && <small>Ghi chu: {addr.note}</small>}
                  {Number(addr.is_default) !== 1 && (
                    <button className="btn ghost" type="button" onClick={() => setDefault(addr.id)}>Dat mac dinh</button>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        <button className="btn ghost" onClick={() => setShowAddressForm((v) => !v)}>
          {showAddressForm ? 'Dong form' : 'Them dia chi moi'}
        </button>

        {showAddressForm && (
          <form className="address-form" onSubmit={onAddAddress}>
            <input required placeholder="Nguoi nhan" value={addressForm.receiver_name} onChange={(e) => setAddressForm((p) => ({ ...p, receiver_name: e.target.value }))} />
            <input required placeholder="So dien thoai" value={addressForm.phone} onChange={(e) => setAddressForm((p) => ({ ...p, phone: e.target.value }))} />
            <input required placeholder="Dia chi cu the" value={addressForm.line1} onChange={(e) => setAddressForm((p) => ({ ...p, line1: e.target.value }))} />
            <input placeholder="Phuong/Xa" value={addressForm.ward} onChange={(e) => setAddressForm((p) => ({ ...p, ward: e.target.value }))} />
            <input placeholder="Quan/Huyen" value={addressForm.district} onChange={(e) => setAddressForm((p) => ({ ...p, district: e.target.value }))} />
            <input required placeholder="Tinh/Thanh pho" value={addressForm.city} onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))} />
            <input placeholder="Ghi chu" value={addressForm.note} onChange={(e) => setAddressForm((p) => ({ ...p, note: e.target.value }))} />
            <button className="btn neon" type="submit">Luu dia chi</button>
          </form>
        )}
      </article>

      <article className="card">
        <h1>Thong tin don hang</h1>
        <p>Kieu hien thi mo phong Shopee: chi tiet san pham, phi van chuyen va tong thanh toan.</p>

        {!items.length && <p>Gio hang dang trong.</p>}
        {items.map((it) => (
          <div className="cart-item" key={it.id}>
            <div>
              <strong>{it.name}</strong>
              <p>{it.category} - So luong: {it.quantity}</p>
            </div>
            <span>{formatPriceVndFromUsd(it.price * it.quantity)}</span>
          </div>
        ))}

        <div className="checkout-summary">
          <div className="row"><span>Tam tinh</span><strong>{formatPriceVndFromUsd(total)}</strong></div>
          <div className="row"><span>Phi van chuyen</span><strong>{formatPriceVndFromUsd(shippingFee)}</strong></div>
          <div className="row total-row"><span>Tong thanh toan</span><strong>{formatPriceVndFromUsd(grandTotal)}</strong></div>
        </div>

        <button
          className="btn neon"
          onClick={onPay}
          disabled={loading || !items.length || !selectedAddress}
        >
          {loading ? 'Dang xu ly...' : 'Dat hang va thanh toan'}
        </button>
      </article>
    </section>
  );
}
