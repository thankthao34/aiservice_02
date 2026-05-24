import http from './http';

export const productService = {
  list: (params = {}) => http.get('/products', { params }),
  featured: () => http.get('/products/featured'),
  detail: (id) => http.get(`/products/${id}`),
  byIds: (ids) => http.get('/products/by-ids', { params: { ids: ids.join(',') } }),
  categories: () => http.get('/products/categories'),
  reviews: (productId) => http.get(`/products/${productId}/reviews`),
  adminReviews: () => http.get('/products/admin/reviews'),
  userReviews: (userId) => http.get(`/products/reviews/user/${userId}`),
  addReview: (productId, payload) => http.post(`/products/${productId}/reviews`, payload),
  adminList: () => http.get('/products/admin/products'),
  adminCreate: (payload) => http.post('/products/admin/products', payload),
  adminUpdate: (id, payload) => http.put(`/products/admin/products/${id}`, payload),
  adminUploadImage: (id, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return http.post(`/products/admin/products/${id}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  adminDelete: (id) => http.delete(`/products/admin/products/${id}`),
  adminDeleteReview: (reviewId) => http.delete(`/products/reviews/${reviewId}`)
};
