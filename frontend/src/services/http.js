import axios from 'axios';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  const rawUser = localStorage.getItem('auth_user');
  const role = rawUser ? JSON.parse(rawUser)?.role : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (role) {
    config.headers['x-user-role'] = role;
  }
  return config;
});

export default http;
