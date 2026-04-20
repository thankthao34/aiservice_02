import http from './http';

export const orderService = {
  create: (payload) => http.post('/orders/create', payload),
  pay: (id) => http.post(`/orders/pay/${id}`),
  history: (userId) => http.get(`/orders/user/${userId}`),
  purchasedItems: (userId) => http.get(`/orders/user/${userId}/purchased-items`),
  canReview: (userId, productId) => http.get('/orders/can-review', { params: { user_id: userId, product_id: productId } }),
  adminOrders: () => http.get('/orders/admin/orders'),
  adminUpdateStatus: (id, status) => http.put(`/orders/admin/orders/${id}/status`, { status })
};
