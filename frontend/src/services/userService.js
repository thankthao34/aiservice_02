import http from './http';

export const userService = {
  register: (payload) => http.post('/users/register', payload),
  login: (payload) => http.post('/users/login', payload),
  getProfile: (id) => http.get(`/users/profile/${id}`),
  updateProfile: (id, payload) => http.put(`/users/update/${id}`, payload),
  addresses: (userId) => http.get(`/users/addresses/${userId}`),
  addAddress: (userId, payload) => http.post(`/users/addresses/${userId}`, payload),
  updateAddress: (userId, addressId, payload) => http.put(`/users/addresses/${userId}/${addressId}`, payload),
  setDefaultAddress: (userId, addressId) => http.patch(`/users/addresses/${userId}/${addressId}/default`),
  deleteAddress: (userId, addressId) => http.delete(`/users/addresses/${userId}/${addressId}`),
  adminListUsers: () => http.get('/users/admin/users'),
  adminCreateUser: (payload) => http.post('/users/admin/users', payload),
  adminUpdateUser: (id, payload) => http.put(`/users/admin/users/${id}`, payload),
  adminDeleteUser: (id) => http.delete(`/users/admin/users/${id}`)
};
