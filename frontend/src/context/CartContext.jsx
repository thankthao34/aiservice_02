import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { cartService } from '../services/cartService';
import { clearCartStorage, getCartItemsKey, getCartProductIdsKey } from '../utils/cartStorage';

const CartContext = createContext(null);
const CART_SYNC_DELAY = 350;

function toFrontendItem(item) {
  if (!item) return null;
  const id = Number(item.id ?? item.product_id);
  if (!Number.isFinite(id)) return null;

  return {
    ...item,
    id,
    name: item.name ?? item.product_name ?? `Product ${id}`,
    price: Number(item.price ?? item.product_price ?? 0) || 0,
    image_url: item.image_url ?? item.product_image ?? '',
    category: item.category ?? item.product_category ?? '',
    sub_category: item.sub_category ?? item.product_subcategory ?? '',
    quantity: Number(item.quantity || 1)
  };
}

function readCartFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(toFrontendItem).filter(Boolean) : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function mergeItems(primaryItems, secondaryItems) {
  const map = new Map();

  for (const item of [...secondaryItems, ...primaryItems]) {
    if (!item || item.id == null) continue;
    const id = Number(item.id);
    if (!Number.isFinite(id)) continue;
    const current = map.get(id);
    if (!current) {
      map.set(id, { ...item, id, quantity: Number(item.quantity || 1) });
      continue;
    }

    map.set(id, {
      ...current,
      ...item,
      id,
      quantity: Number(current.quantity || 0) + Number(item.quantity || 0)
    });
  }

  return Array.from(map.values());
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const cartItemsKey = getCartItemsKey(user);
  const cartProductIdsKey = getCartProductIdsKey(user);
  const syncTimerRef = useRef(null);
  const prevUserIdRef = useRef(null);
  const prevItemsRef = useRef([]);

  const [items, setItems] = useState(() => readCartFromStorage(cartItemsKey));

  useEffect(() => {
    const localItems = readCartFromStorage(cartItemsKey);

    const prevUserId = prevUserIdRef.current;
    const nextUserId = user?.id || null;
    const previousItems = prevItemsRef.current || [];

    if (prevUserId && prevUserId !== nextUserId && previousItems.length) {
      cartService.sync(prevUserId, previousItems)
        .catch(() => {
          // best-effort flush for the previous user
        })
        .finally(() => {
          clearCartStorage({ id: prevUserId });
        });
    }

    const switchToUserCart = async () => {
      if (!user) {
        setItems(localItems);
        return;
      }

      try {
        const { data } = await cartService.get(user.id);
        const serverItems = Array.isArray(data) ? data.map(toFrontendItem).filter(Boolean) : [];
        const guestItems = readCartFromStorage(getCartItemsKey(null));
        const mergedItems = mergeItems(serverItems.length ? serverItems : localItems, guestItems);

        setItems(mergedItems);
        localStorage.setItem(cartItemsKey, JSON.stringify(mergedItems));
        localStorage.setItem(cartProductIdsKey, JSON.stringify(mergedItems.map((it) => it.id).filter((id) => id != null)));

        if (mergedItems.length) {
          cartService.sync(user.id, mergedItems).catch(() => {
            // background sync only
          });
        }

        clearCartStorage(null);
      } catch {
        setItems(localItems);
      }
    };

    switchToUserCart();

    prevUserIdRef.current = nextUserId;
    prevItemsRef.current = localItems;
  }, [cartItemsKey, cartProductIdsKey, user]);

  useEffect(() => {
    if (!user) return undefined;

    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      cartService.sync(user.id, items).catch(() => {
        // background sync only
      });
    }, CART_SYNC_DELAY);

    return () => clearTimeout(syncTimerRef.current);
  }, [items, user]);

  const persist = (next) => {
    setItems(next);
    localStorage.setItem(cartItemsKey, JSON.stringify(next));
    const cartProductIds = next.map((it) => it.id).filter((id) => id != null);
    localStorage.setItem(cartProductIdsKey, JSON.stringify(cartProductIds));
    prevItemsRef.current = next;
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
