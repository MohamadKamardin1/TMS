import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const TOKEN_KEY = 'tms_token';
const USER_KEY = 'tms_user';

const AuthContext = createContext(null);

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Global authentication state. Keeps the JWT and the current user (+ role) in
 * localStorage so a page refresh restores the session, and exposes
 * login/register/logout used by the auth pages and the navbar.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);

  // When a token exists, hydrate the stored profile (fullName, etc.) from the
  // backend so the UI can greet the user properly after a refresh.
  useEffect(() => {
    if (!token) return;
    api
      .get('/users/me')
      .then(({ data }) => {
        setUser((prev) => {
          const next = { ...(prev || {}), ...data.data };
          localStorage.setItem(USER_KEY, JSON.stringify(next));
          return next;
        });
      })
      .catch(() => {
        /* 401 interceptor already handles expired tokens */
      });
  }, [token]);

  function storeSession(payload) {
    const authUser = { username: payload.username, role: payload.role };
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setToken(payload.token);
    setUser(authUser);
    return authUser;
  }

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials);
    return storeSession(data.data);
  }

  async function register(profile) {
    const { data } = await api.post('/auth/register', profile);
    return storeSession(data.data);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  const value = {
    token,
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(token),
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}