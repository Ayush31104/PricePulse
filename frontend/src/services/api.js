// ============================================================
// services/api.js — Centralised Axios HTTP client
// ============================================================
// All backend communication goes through this file.
// It creates a single configured Axios instance so every request
// automatically gets the right base URL, timeout, and auth header.
//
// Vite's dev proxy (vite.config.js) forwards /api → http://localhost:5000
// so we never hardcode the backend URL in component code — this makes
// it easy to switch between dev and production environments.

import axios from 'axios';

// Create a reusable Axios instance with shared configuration
const api = axios.create({
  baseURL: '/api',    // all requests are relative to /api
  timeout: 15000,     // 15 seconds — scraping can be slow
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Runs before EVERY outgoing request.
// If the user is logged in (token stored in localStorage), attach it
// to the Authorization header so protected routes accept the request.
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
// Runs after EVERY response comes back.
// On success: pass through unchanged (callers destructure res.data themselves)
// On error:   extract the most useful error message from the backend envelope
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Try to get the message from the backend's { success, message } envelope,
    // fall back to Axios's own error message if the backend didn't respond
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ── Product endpoints ─────────────────────────────────────────────────────────
export const productService = {
  // Search products by name across all platforms
  // GET /api/products/search?q=...&sort=...&platform=...
  search: (query, { sort = 'price_asc', platform = '' } = {}) => {
    const params = { q: query };
    if (sort)     params.sort     = sort;
    if (platform) params.platform = platform;
    return api.get('/products/search', { params });
  },

  // Compare prices by pasting a product URL
  // POST /api/products/compare-link  body: { url }
  compareLink: (url) => api.post('/products/compare-link', { url }),

  // Fetch a single product by its MongoDB _id
  // GET /api/products/:id
  getById: (id) => api.get(`/products/${id}`),

  // Fetch the top 10 trending searches from the last 24 hours
  // GET /api/products/trending
  getTrending: () => api.get('/products/trending'),
};

// ── Auth endpoints ────────────────────────────────────────────────────────────
export const authService = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login',    data),
  getMe:    ()     => api.get('/auth/me'),
};

// ── User endpoints ────────────────────────────────────────────────────────────
export const userService = {
  getProfile:    ()     => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
};

// History endpoints (requires auth)
export const historyService = {
  // limit defaults to 20; pass 10 for the dashboard view
  getHistory:   (limit = 20) => api.get('/history', { params: { limit } }),
  clearHistory: () => api.delete('/history'),
  saveSearch:   (data) => api.post('/history', data),
};

// ── Health check ──────────────────────────────────────────────────────────────
export const healthService = {
  // Pings the backend to check if it's reachable
  check: () => api.get('/health'),
};

export default api;
