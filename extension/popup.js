// ============================================================
// extension/popup.js — Popup UI controller
// ============================================================
// This script runs inside popup.html when the user clicks the
// extension icon. It orchestrates the entire popup experience:
//
//   1. On open: inject a script into the active tab to read the
//      product title from the page DOM
//   2. Send the title to background.js which calls the backend
//   3. Render the price comparison results as cards
//
// Data flow:
//   popup.js
//     → chrome.scripting.executeScript (reads DOM title from the tab)
//     → chrome.runtime.sendMessage SEARCH_PRODUCTS
//     → background.js (checks cache, calls backend if needed)
//     → backend GET /api/products/search?q=...
//     → background.js returns { products, meta, fromCache }
//     → popup.js renders the result cards

import { trackProductPrice, generateProductId } from './services/priceTracker.js';
import priceHistoryStorage from './services/priceHistoryStorage.js';

// Shorthand helper — gets a DOM element by its id attribute
const $ = (id) => document.getElementById(id);

// Collect all the UI elements we'll need to show/hide and update
const ui = {
  productBar:  $('product-bar'),   // the purple bar showing the detected product name
  productName: $('product-name'),  // text inside the product bar
  btnRefresh:  $('btn-refresh'),   // ↻ button to force a fresh fetch
  searchInput: $('search-input'),  // manual search text input
  btnSearch:   $('btn-search'),    // "Go" button
  spinner:     $('state-spinner'), // loading spinner shown while fetching
  error:       $('state-error'),   // error message container
  errorMsg:    $('error-msg'),     // the actual error text
  empty:       $('state-empty'),   // "No results found" message
  results:     $('results'),       // the container where product cards are injected
  priceHistory: $('price-history'),
  priceChart: $('price-chart'),
  priceStats: $('price-stats'),
};

// Tracks the last searched query so the refresh button knows what to re-search
let currentQuery = '';
let currentProductId = null;
let chart = null;

// ── Boot sequence ─────────────────────────────────────────────────────────────
// Runs immediately when the popup opens (IIFE = Immediately Invoked Function Expression)
(async () => {
  // Try to extract the product title from the currently active browser tab
  const { title, url } = await getPageInfo();
  if (title) {
    currentQuery = title;
    currentProductId = generateProductId(url, title);
    ui.productName.textContent = title; // show it in the purple product bar
    ui.searchInput.value = title;       // pre-fill the search input
    show(ui.productBar);
    await search(title);                // automatically trigger a search
  }
  // If no title was found (e.g. user is on a non-product page),
  // the search bar is still available for manual input
})();

// ── Event listeners ───────────────────────────────────────────────────────────

// "Go" button click — search whatever is in the input box
ui.btnSearch.addEventListener('click', () => {
  const q = ui.searchInput.value.trim();
  if (q) { currentQuery = q; search(q); }
});

// Allow pressing Enter in the search box instead of clicking "Go"
ui.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ui.btnSearch.click();
});

// Refresh button — clears the extension cache for this query and re-fetches
ui.btnRefresh.addEventListener('click', () => {
  if (currentQuery) {
    // Tell background.js to delete the cached result for this query
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE', query: currentQuery });
    search(currentQuery);
  }
});

// ── Core ──────────────────────────────────────────────────────────────────────
/**
 * Injects a small function into the active browser tab to read the
 * product title from the page's DOM. This is more reliable than
 * messaging content.js because it runs synchronously in the tab context.
 *
 * @returns {{title: string|null, url: string}} — product title and URL
 */
async function getPageInfo() {
  try {
    // Get the currently active tab in the current window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { title: null, url: null };

    // executeScript injects the function into the tab and returns its return value
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // This function runs INSIDE the browser tab, not in the extension
        const SELECTORS = [
          '#productTitle', '#title span',          // Amazon
          'span.B_NuCI', 'h1.yhB1nd span',         // Flipkart
          'h1.x-item-title__mainTitle span', '#itemTitle', // eBay
          'h1[data-buy-box-listing-title]', 'h1.wt-text-body-03', // Etsy
          'h1.pdp-title', 'h1.pdp-e-i-head',       // Myntra, Snapdeal
          'h1',                                     // generic fallback
        ];
        for (const sel of SELECTORS) {
          const t = document.querySelector(sel)?.innerText?.trim();
          if (t && t.length > 2) return t; // return the first non-empty title found
        }
        return null;
      },
    });
    return { title: result || null, url: tab.url };
  } catch {
    // executeScript fails on chrome:// pages, PDFs, etc. — silently return null
    return { title: null, url: null };
  }
}

// ── search ────────────────────────────────────────────────────────────────────
/**
 * Sends a SEARCH_PRODUCTS message to background.js and renders the result.
 * Shows a loading spinner while waiting, and an error message if it fails.
 *
 * @param {string} query — product name to search for
 */
async function search(query) {
  setState('loading');
  try {
    // background.js handles caching and the actual HTTP request
    const data = await chrome.runtime.sendMessage({ type: 'SEARCH_PRODUCTS', query });
    if (data?.error) throw new Error(data.error);
    render(data);
  } catch (err) {
    setState('error', err.message || 'Could not reach the backend. Is it running on port 5000?');
  }
}

// ── render ────────────────────────────────────────────────────────────────────
/**
 * Builds and injects the HTML for the results section.
 * Shows a meta bar (Live/Cached badge + timestamp) and one card per product.
 *
 * @param {{ products, meta, fromCache }} data — response from background.js
 */
function render({ products, meta, fromCache }) {
  if (!products?.length) { setState('empty'); return; }

  setState('results');

  // Find the lowest price so we can highlight the cheapest card
  const minPrice = Math.min(...products.map((p) => p.price));

  // Format the fetch timestamp for display (e.g. "02:45 PM")
  const fetchedAt = meta?.fetchedAt ? new Date(meta.fetchedAt) : new Date();
  const timeStr   = fetchedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // If only one platform returned results, show a warning
  const partialMsg = meta?.partialErrors?.length
    ? `<p class="partial-warn">⚠ Partial results — ${meta.partialErrors.join('; ')}</p>`
    : '';

  // Build the results HTML: meta bar + one card per product
  ui.results.innerHTML =
    // Meta bar: shows whether data is live or cached, and when it was fetched
    `<div class="results-meta">
       ${fromCache
         ? '<span class="badge badge-cache">⚡ Cached</span>'
         : '<span class="badge badge-live">🟢 Live</span>'}
       <span class="updated-at">Updated ${timeStr}</span>
     </div>
     ${partialMsg}` +

    // One card per product
    products.map((p) => {
      const isCheapest = p.price === minPrice;

      // Build a star string: e.g. "★★★★☆ 4.2"
      const stars = p.rating
        ? `${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))} ${p.rating}`
        : '';

      return `
        <div class="card ${isCheapest ? 'cheapest' : ''}">
          <div class="card-body">
            <div class="card-top">
              <span class="card-platform">${esc(p.platform)}</span>
              ${isCheapest ? '<span class="card-badge">BEST PRICE</span>' : ''}
            </div>
            <div class="card-title">${esc(p.name || p.title || '')}</div>
            ${stars ? `<div class="card-rating">${stars}</div>` : ''}
          </div>
          <div class="card-right">
            <div class="card-price">${formatInr(p.price)}</div>
            ${p.url
              ? `<a class="card-link" href="${esc(p.url)}" target="_blank">View →</a>`
              : ''}
          </div>
        </div>`;
    }).join('');

  // Track price and show history
  if (currentProductId && currentQuery) {
    trackProductPrice({ productId: currentProductId, title: currentQuery, currentPrice: minPrice });
    showPriceHistory(currentProductId, currentQuery);
  }
}

// ── setState ──────────────────────────────────────────────────────────────────
/**
 * Controls which UI state is visible.
 * Only one state is shown at a time: loading | error | empty | results
 *
 * @param {'loading'|'error'|'empty'|'results'} state
 * @param {string} msg — error message text (only used when state = 'error')
 */
function setState(state, msg = '') {
  // Hide all state elements first
  hide(ui.spinner);
  hide(ui.error);
  hide(ui.empty);
  hide(ui.priceHistory);

  // Clear results unless we're about to render new ones
  if (state !== 'results') ui.results.innerHTML = '';

  // Show only the relevant element
  if      (state === 'loading') show(ui.spinner);
  else if (state === 'error')  { ui.errorMsg.textContent = msg; show(ui.error); }
  else if (state === 'empty')    show(ui.empty);
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * esc(str)
 * Escapes HTML special characters to prevent XSS when injecting
 * user-supplied strings (like product titles) into innerHTML.
 */
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * formatInr(price)
 * Formats a number as an Indian Rupee string using the en-IN locale.
 * Examples: 68999 → "₹68,999"  |  125000 → "₹1,25,000"
 * Returns "N/A" for null, undefined, or non-numeric values.
 */
function formatInr(price) {
  if (price == null || isNaN(price)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style:                 'currency',
    currency:              'INR',
    maximumFractionDigits: 0, // no decimal places for rupees
  }).format(price);
}

async function showPriceHistory(productId, title) {
  try {
    const history = await priceHistoryStorage.getProductHistory(productId);
    if (!history || history.prices.length < 2) return; // Need at least 2 points for chart

    show(ui.priceHistory);

    // Destroy previous chart
    if (chart) chart.destroy();

    const ctx = ui.priceChart.getContext('2d');
    const labels = history.prices.map(p => new Date(p.timestamp).toLocaleDateString());
    const data = history.prices.map(p => p.price);

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Price (INR)',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: false
          }
        }
      }
    });

    // Show stats
    const prices = history.prices.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    ui.priceStats.innerHTML = `
      <p><strong>Lowest:</strong> ${formatInr(minPrice)}</p>
      <p><strong>Highest:</strong> ${formatInr(maxPrice)}</p>
    `;
  } catch (error) {
    console.error('Failed to show price history:', error);
  }
}
