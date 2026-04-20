import http from './http';

export const aiService = {
  segment: (payload) => http.post('/ai/segment', payload),
  recommend: (userId, options = {}) => {
    const params = new URLSearchParams();
    if (options.message) params.set('message', options.message);
    if (options.budgetVnd != null) params.set('budget_vnd', String(options.budgetVnd));
    if (options.budgetUsd != null) params.set('budget_usd', String(options.budgetUsd));
    if (Array.isArray(options.cartProductIds) && options.cartProductIds.length) {
      params.set('cart_product_ids', options.cartProductIds.join(','));
    }
    if (options.limit != null) params.set('limit', String(options.limit));
    const query = params.toString();
    return http.get(`/ai/recommend/${userId}${query ? `?${query}` : ''}`);
  },
  chat: (payload) => http.post('/ai/chat', payload)
};
