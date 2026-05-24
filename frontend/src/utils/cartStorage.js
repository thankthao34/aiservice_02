const GUEST_KEY = 'guest';

function getUserKey(user) {
  if (!user) return GUEST_KEY;
  return String(user.id || user._id || user.email || GUEST_KEY).trim() || GUEST_KEY;
}

export function getCartItemsKey(user) {
  return `cart_items:${getUserKey(user)}`;
}

export function getCartProductIdsKey(user) {
  return `nexus_last_cart_product_ids:${getUserKey(user)}`;
}

export function clearCartStorage(user) {
  localStorage.removeItem(getCartItemsKey(user));
  localStorage.removeItem(getCartProductIdsKey(user));
}
