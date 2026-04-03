// extension/background.js — Service worker (Manifest V3)
//
// IMPORTANT: MV3 service workers are intentionally terminated by Chrome
// after ~30s of inactivity. "Inactive" in chrome://extensions is NORMAL.
// The worker wakes automatically when the popup sends a message.
//
// Rules for keeping this file service-worker safe:
//   - No long setTimeout (Chrome may kill the worker mid-wait)
//   - No global state that must persist (use chrome.storage instead)
//   - Always return true from onMessage for async handlers

const API_BASE  = 'https://pricepulse-be.onrender.com/api';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Keep-alive ping ───────────────────────────────────────────────────────────
// Registers an alarm that fires every 20s to prevent premature termination
// during long-running operations (e.g. Render cold-start fetch).
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // No-op — just wakes the worker
  }
});

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'SEARCH_PRODUCTS') {
    handleSearch(msg.query)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep channel open
  }

  if (msg.type === 'COMPARE_LINK') {
    handleCompareLink(msg.url)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'CONTENT_READY') {
    // Content script loaded on a product page — no response needed
    return false;
  }

  if (msg.type === 'CLEAR_CACHE') {
    chrome.storage.local.remove(cacheKey(msg.key || msg.query || ''));
    return false;
  }

  if (msg.type === 'GET_PRICE_HISTORY') {
    fetchPriceHistory(msg.productId)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  if (msg.type === 'RECORD_PRICE_SNAPSHOT') {
    recordPriceSnapshot(msg.productId, msg.title, msg.price)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.warn('[PricePulse bg] snapshot failed:', err.message);
        sendResponse({ ok: false });
      });
    return true;
  }
});

// ── handleSearch ──────────────────────────────────────────────────────────────
async function handleSearch(query) {
  const key    = cacheKey('search_' + query.toLowerCase().trim());
  const stored = await chromeGet(key);
  if (stored && Date.now() - stored.ts < CACHE_TTL) {
    return { ...stored.data, fromCache: true };
  }

  const url = `${API_BASE}/products/search?q=${encodeURIComponent(query)}`;
  console.log('[PricePulse bg] Search:', url);

  const res  = await fetchSafe(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Backend error (${res.status})`);

  const result = {
    products: json.data    || [],
    meta:     json.meta    || {},
    message:  json.message || '',
  };
  await chromeSet(key, { data: result, ts: Date.now() });
  return result;
}

// ── handleCompareLink ─────────────────────────────────────────────────────────
async function handleCompareLink(productUrl) {
  const key    = cacheKey('url_' + productUrl);
  const stored = await chromeGet(key);
  if (stored && Date.now() - stored.ts < CACHE_TTL) {
    return { ...stored.data, fromCache: true };
  }

  const res  = await fetchSafe(`${API_BASE}/products/compare-link`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: productUrl }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Backend error (${res.status})`);

  const result = {
    parsedProduct: json.data?.parsedProduct || null,
    products:      json.data?.products      || [],
    meta:          json.data?.meta          || {},
    message:       json.message             || '',
  };
  await chromeSet(key, { data: result, ts: Date.now() });
  return result;
}

// ── fetchPriceHistory ─────────────────────────────────────────────────────────
// Backend envelope: { success, data: { data: [{date,price},...], stats: {...} } }
// Returns json.data = { data: [...], stats: {...} } so popup reads .data for array.
async function fetchPriceHistory(productId) {
  try {
    const url = `${API_BASE}/products/price-history?productId=${encodeURIComponent(productId)}`;
    console.log('[PricePulse bg] GET price-history:', url);
    const res  = await fetchSafe(url);
    const json = await res.json();
    console.log('[PricePulse bg] price-history response:', JSON.stringify(json).substring(0, 400));
    if (!res.ok) throw new Error(json.message || `Backend error (${res.status})`);
    return json.data ?? { data: [], stats: null };
  } catch (err) {
    console.warn('[PricePulse bg] fetchPriceHistory failed:', err.message);
    return { data: [], stats: null };
  }
}

// ── recordPriceSnapshot ───────────────────────────────────────────────────────
async function recordPriceSnapshot(productId, title, price) {
  const res = await fetchSafe(`${API_BASE}/products/price-history`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ productId, title, price }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message || `Backend error (${res.status})`);
  }
}

// ── fetchSafe ─────────────────────────────────────────────────────────────────
// Service-worker safe fetch with a 25s timeout.
// Does NOT use setTimeout for retry (which can be killed mid-wait).
// Instead uses AbortController so the fetch itself times out cleanly.
async function fetchSafe(url, options = {}) {
  const controller = new AbortController();
  // 25s timeout — enough for Render cold-start (~15s) with headroom
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out — backend may be starting up, please try again');
    }
    throw err;
  }
}

// ── chrome.storage helpers ────────────────────────────────────────────────────
function cacheKey(str) {
  return `pp_${str.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 80)}`;
}
function chromeGet(key) {
  return new Promise((resolve) =>
    chrome.storage.local.get(key, (r) => resolve(r[key] ?? null))
  );
}
function chromeSet(key, value) {
  return new Promise((resolve) =>
    chrome.storage.local.set({ [key]: value }, resolve)
  );
}
