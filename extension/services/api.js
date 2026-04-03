// extension/services/api.js
// Centralised API helpers — imported only by background.js (service worker).
// All fetch calls to the backend live here.

const API_BASE = 'https://pricepulse-be.onrender.com/api';
const RETRY_DELAY_MS = 8000; // Render cold-start grace period

// ── fetchWithRetry ────────────────────────────────────────────────────────────
// Retries once after RETRY_DELAY_MS on network failure (Render cold-start).
async function fetchWithRetry(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    console.warn('[PricePulse] Retrying after cold-start delay…', err.message);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fetch(url, options);
  }
}

// ── searchByQuery ─────────────────────────────────────────────────────────────
// GET /api/products/search?q=<query>
// Returns { products, meta }
export async function searchByQuery(query) {
  const res  = await fetchWithRetry(`${API_BASE}/products/search?q=${encodeURIComponent(query)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Backend error (${res.status})`);
  return { products: json.data || [], meta: json.meta || {} };
}

// ── compareByUrl ──────────────────────────────────────────────────────────────
// POST /api/products/compare-link  { url }
// Returns { parsedProduct, products, meta }
export async function compareByUrl(url) {
  const res  = await fetchWithRetry(`${API_BASE}/products/compare-link`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Backend error (${res.status})`);
  return {
    parsedProduct: json.data?.parsedProduct || null,
    products:      json.data?.products      || [],
    meta:          json.data?.meta          || {},
  };
}

// ── getPriceHistory ───────────────────────────────────────────────────────────
// GET /api/products/price-history?productId=<id>
// Returns { data: [{date, price}], stats: {min, max, avg, current} }
export async function getPriceHistory(productId) {
  try {
    const res  = await fetch(`${API_BASE}/products/price-history?productId=${encodeURIComponent(productId)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || `Backend error (${res.status})`);
    return json.data ?? { data: [], stats: null };
  } catch (err) {
    console.warn('[PricePulse] getPriceHistory failed:', err.message);
    return { data: [], stats: null };
  }
}

// ── recordPriceSnapshot ───────────────────────────────────────────────────────
// POST /api/products/price-history  { productId, title, price }
export async function recordPriceSnapshot(productId, title, price) {
  const res = await fetch(`${API_BASE}/products/price-history`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ productId, title, price }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || `Backend error (${res.status})`);
  }
}
