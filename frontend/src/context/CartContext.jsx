import { createContext, useContext, useMemo, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem('cart_items');
      return raw ? JSON.parse(raw) : [];
    } catch {
      localStorage.removeItem('cart_items');
      return [];
    }
  });

  const persist = (next) => {
    setItems(next);
    localStorage.setItem('cart_items', JSON.stringify(next));
    const cartProductIds = next.map((it) => it.id).filter((id) => id != null);
    localStorage.setItem('nexus_last_cart_product_ids', JSON.stringify(cartProductIds));
  };

  const addToCart = (product, quantity = 1) => {
    const found = items.find((it) => it.id === product.id);
    if (found) {
      persist(items.map((it) => (it.id === product.id ? { ...it, quantity: it.quantity + quantity } : it)));
      return;
    }
    persist([...items, { ...product, quantity }]);
  };

  const updateQty = (id, quantity) => {
    if (quantity <= 0) {
      persist(items.filter((i) => i.id !== id));
      return;
    }
    persist(items.map((i) => (i.id === id ? { ...i, quantity } : i)));
  };

  const clearCart = () => persist([]);

  const total = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const value = useMemo(() => ({ items, addToCart, updateQty, clearCart, total, count }), [items, total, count]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
