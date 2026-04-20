import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { userService } from '../services/userService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, role: parsed.role || 'customer' };
  });

  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));

  useEffect(() => {
    if (user) localStorage.setItem('auth_user', JSON.stringify(user));
    else localStorage.removeItem('auth_user');
  }, [user]);

  useEffect(() => {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  }, [token]);

  const login = async (email, password) => {
    const { data } = await userService.login({ email, password });
    setUser({ ...data.user, role: data.user?.role || 'customer' });
    setToken(data.token);
    return data.user;
  };

  const register = async (name, email, password) => {
    const { data } = await userService.register({ name, email, password });
    return data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({ user, token, isAdmin: user?.role === 'admin', login, register, logout, setUser }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
