import axios from 'axios';

/**
 * Resolves a backend-relative media path (e.g. "/uploads/x.jpg") to a full URL
 * against the API origin, so uploaded images render in the browser.
 */
export function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const rawBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  try {
    const origin = new URL(rawBase, window.location.origin).origin;
    return origin + (path.startsWith('/') ? path : `/${path}`);
  } catch {
    return path;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response, config } = error;

    if (response?.status === 401) {
      const isAuthRequest =
        config?.url?.includes('/auth/login') || config?.url?.includes('/auth/register');

      // Only redirect for expired/invalid tokens, not failed login attempts.
      if (!isAuthRequest) {
        localStorage.removeItem('tms_token');
        localStorage.removeItem('tms_user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;