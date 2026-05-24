import http from './http';

export const cartService = {
  get: (userId) => http.get(`/users/cart/${userId}`),
  sync: (userId, items) => http.put(`/users/cart/${userId}`, { items }),
  addItem: (userId, item) => http.post(`/users/cart/${userId}/items`, item),
  setItemQty: (userId, productId, quantity, item = {}) =>
    http.put(`/users/cart/${userId}/items/${productId}`, { ...item, quantity }),
  removeItem: (userId, productId) => http.delete(`/users/cart/${userId}/items/${productId}`),
  clear: (userId) => http.delete(`/users/cart/${userId}`)
};
