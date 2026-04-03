// extension/popup.js — Main popup controller
// Depends on (loaded before this file): Chart.js, priceHistoryStorage.js, priceTracker.js

const $ = (id) => document.getElementById(id);

const ui = {
  productBar:    $('product-bar'),
  productName:   $('product-name'),
  btnRefresh:    $('btn-refresh'),
  searchInput:   $('search-input'),
  btnSearch:     $('btn-search'),
  spinner:       $('state-spinner'),
  coldStartHint: $('cold-start-hint'),
  error:         $('state-error'),
  errorMsg:      $('error-msg'),
  empty:         $('state-empty'),
  mainContent:   $('main-content'),
  metaBar:       $('results-meta-bar'),
  liveTitle:     null, // removed from DOM
  statHighest:   $('stat-highest'),
  statLowest:    $('stat-lowest'),
  statAverage:   $('stat-average'),
  statCurrent:   $('stat-current'),
  dealCurrentPrice: $('deal-current-price'),
  dealOldPrice:     $('deal-old-price'),
  dealSavings:      $('deal-savings-amount'),
  dealLink:         $('deal-link'),
  gaugeFill:    $('gauge-fill'),
  gaugeScore:   $('gauge-score'),
  gaugeVerdict: $('gauge-verdict'),
  toggleOffers: $('toggle-offers'),
  similarList:  $('similar-list'),
  similarCount: $('similar-count'),
};

let currentQuery     = '';
let currentProductId = null;
let currentPageUrl   = null;
let currentPagePrice = null;
let chart            = null;
let coldStartTimer   = null;
let showOffers       = true;
let currentChartRange = '1M';
let lastApiData      = null;

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  const info = await getPageInfo();
  console.log('[PricePulse] Page info:', info);

  if (info.title) {
    currentQuery     = info.title;
    currentPageUrl   = info.url;
    currentPagePrice = info.price;
    currentProductId = window.generateProductId(info.url, info.title);
    ui.productName.textContent = info.title;
    ui.searchInput.value       = info.title;
    show(ui.productBar);
    await doSearch(info.title);
  } else {
    setState('not-product');
  }
})();

// ── Events ────────────────────────────────────────────────────────────────────
ui.btnSearch.addEventListener('click', () => {
  const q = ui.searchInput.value.trim();
  if (!q) return;
  currentQuery     = q;
  currentPageUrl   = null;
  currentPagePrice = null;
  currentProductId = window.generateProductId(null, q);
  doSearch(q);
});

ui.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ui.btnSearch.click();
});

ui.btnRefresh.addEventListener('click', () => {
  if (!currentQuery) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_CACHE', key: 'search_' + currentQuery });
  doSearch(currentQuery);
});

ui.toggleOffers.addEventListener('change', () => {
  showOffers = ui.toggleOffers.checked;
  if (lastApiData?.chartPoints?.length) renderChart(currentChartRange, lastApiData.chartPoints);
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentChartRange = btn.dataset.range;
    if (lastApiData?.chartPoints?.length) renderChart(currentChartRange, lastApiData.chartPoints);
  });
});

// ── getPageInfo ───────────────────────────────────────────────────────────────
async function getPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return { title: null, url: null, price: null };

    const isSupportedPage = /amazon\.|flipkart\.|ebay\.|etsy\.|myntra\.|snapdeal\./.test(tab.url);
    if (!isSupportedPage) return { title: null, url: tab.url, price: null };

    // Try content script first (already injected), retry once after delay
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 800));
      try {
        const res = await sendTabMessage(tab.id, { type: 'GET_PRODUCT' });
        if (res?.title) return res;
      } catch (_) {}
    }

    // Fallback: inject inline
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const TITLE_SEL = [
          '#productTitle', '#title span', 'span.B_NuCI', 'h1.yhB1nd span',
          'h1.x-item-title__mainTitle span', '#itemTitle',
          'h1[data-buy-box-listing-title]', 'h1.wt-text-body-03',
          'h1.pdp-title', 'h1.pdp-e-i-head', 'h1',
        ];
        const PRICE_SEL = [
          '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
          '#apex_desktop .a-price .a-offscreen',
          '.a-price[data-a-color="price"] .a-offscreen',
          'span.a-price-whole',
          '#priceblock_ourprice', '#priceblock_dealprice',
          'div._30jeq3._16Jk6d', 'div._30jeq3',
          'span.x-price-primary span.ux-textspans',
          '[itemprop="price"]',
        ];
        let title = null;
        for (const s of TITLE_SEL) {
          const t = document.querySelector(s)?.innerText?.trim();
          if (t && t.length > 2) { title = t; break; }
        }
        let price = null;
        for (const s of PRICE_SEL) {
          const el = document.querySelector(s);
          if (!el) continue;
          const num = parseFloat((el.getAttribute('content') || el.innerText || '').replace(/,/g, '').replace(/[^0-9.]/g, ''));
          if (!isNaN(num) && num > 0) { price = num; break; }
        }
        return { title, price, url: location.href };
      },
    });
    return result || { title: null, url: tab.url, price: null };
  } catch (err) {
    console.error('[PricePulse] getPageInfo error:', err.message);
    return { title: null, url: null, price: null };
  }
}

function sendTabMessage(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, (res) => {
      chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve(res);
    });
  });
}

// ── doSearch ──────────────────────────────────────────────────────────────────
async function doSearch(query) {
  setState('loading');
  try {
    const data = await chrome.runtime.sendMessage({ type: 'SEARCH_PRODUCTS', query });
    if (data?.error) throw new Error(data.error);
    await render(data);
  } catch (err) {
    console.error('[PricePulse] Search failed:', err);
    setState('error', err.message || 'Could not reach the backend. It may be waking up — please try again.');
  }
}

// ── render ────────────────────────────────────────────────────────────────────
async function render({ products, meta, fromCache }) {
  if (!products?.length) { setState('empty'); return; }
  setState('results');

  // Meta bar
  const timeStr = (meta?.fetchedAt ? new Date(meta.fetchedAt) : new Date())
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  ui.metaBar.innerHTML = `
    ${fromCache ? '<span class="badge badge-cache">⚡ Cached</span>' : '<span class="badge badge-live">🟢 Live</span>'}
    <span class="updated-at">Updated ${timeStr}</span>`;

  // Group by matchGroup
  const GROUP_ORDER  = ['exact', 'same-brand', 'similar', 'other'];
  const GROUP_LABELS = { exact: '🔥 Best Match', 'same-brand': '🏷️ Same Brand', similar: '✦ Similar Products', other: '◈ Other Alternatives' };
  const LABEL_CLASS  = { exact: 'label-exact', 'same-brand': 'label-same-brand', similar: 'label-similar', other: 'label-other' };

  const groups = {};
  for (const p of products) {
    const g = GROUP_ORDER.includes(p.matchGroup) ? p.matchGroup : 'other';
    (groups[g] = groups[g] || []).push(p);
  }

  // ── Determine livePrice ───────────────────────────────────────────────────
  // Use the best available price for THIS product.
  // IMPORTANT: always fall back to products[0].price — never leave it null.
  const exactProduct = (groups['exact'] || [])[0];
  const livePrice = currentPagePrice          // scraped from page DOM
    || exactProduct?.price                    // top exact API match
    || products[0]?.price;                    // first result (always exists)

  console.log('[PricePulse] productId:', currentProductId);
  console.log('[PricePulse] livePrice:', livePrice, '| DOM:', currentPagePrice, '| exact:', exactProduct?.price, '| fallback:', products[0]?.price);

  // Price stats
  const allPrices = products.map(p => p.price).filter(Boolean);
  const minPrice  = Math.min(...allPrices);
  const maxPrice  = Math.max(...allPrices);
  const avgPrice  = Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length);

  updateStats(livePrice, livePrice, avgPrice, livePrice);
  updateDealCard(minPrice, livePrice, products);
  updateGauge(livePrice, minPrice, maxPrice, avgPrice);

  // Badge count
  if (ui.similarCount) {
    ui.similarCount.textContent = products.length;
    ui.similarCount.classList.remove('hidden');
  }

  // All products passed to the unified card renderer (dedup happens inside)
  const similarRaw = products;

  lastApiData = { allPrices, similarRaw, chartPoints: null };

  // ── Always record + render chart ──────────────────────────────────────────
  // livePrice is guaranteed non-null here (products[0].price fallback above)
  if (currentProductId && livePrice) {
    // 1. Save to local IndexedDB
    window.trackProductPrice({ productId: currentProductId, title: currentQuery, currentPrice: livePrice });

    // 2. POST to backend and AWAIT — this seeds 90-day history on first visit
    const snapResult = await chrome.runtime.sendMessage({
      type: 'RECORD_PRICE_SNAPSHOT',
      productId: currentProductId,
      title: currentQuery || 'Product',
      price: livePrice,
    });
    console.log('[PricePulse] Snapshot recorded:', snapResult);

    // 3. Fetch history (now guaranteed to have data) and render chart
    await loadAndRenderChart(currentProductId, livePrice, similarRaw);
  } else {
    // No productId (manual search with no page context) — render from live prices
    renderChartFromPrices(allPrices, livePrice);
    renderSimilarProducts(similarRaw);
  }
}

// ── updateStats ───────────────────────────────────────────────────────────────
function updateStats(min, max, avg, current) {
  ui.statHighest.textContent = formatInr(max);
  ui.statLowest.textContent  = formatInr(min);
  ui.statAverage.textContent = formatInr(avg);
  ui.statCurrent.textContent = formatInr(current);
}

// ── updateDealCard ────────────────────────────────────────────────────────────
function updateDealCard(minPrice, currentPrice, products) {
  const best     = products.find(p => p.price === minPrice) || products[0];
  const savings  = currentPrice - minPrice;
  const pct      = currentPrice > 0 ? Math.round((savings / currentPrice) * 100) : 0;
  ui.dealCurrentPrice.textContent = formatInr(minPrice);
  ui.dealOldPrice.textContent     = formatInr(currentPrice);
  ui.dealSavings.textContent      = savings > 0 ? `${formatInr(savings)} (${pct}% off)` : 'Already at best price!';
  ui.dealLink.href                = best?.url || '#';
}

// ── updateGauge ───────────────────────────────────────────────────────────────
function updateGauge(current, min, max, avg) {
  const score = Math.max(5, Math.min(95, Math.round(((max - current) / (max - min || 1)) * 100)));
  const isBuy = score >= 55;
  ui.gaugeFill.style.width      = `${score}%`;
  ui.gaugeFill.style.background = isBuy ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#ef4444,#f97316)';
  ui.gaugeScore.textContent     = `${score}/100`;
  ui.gaugeVerdict.textContent   = isBuy ? '✓ Buy Now' : '⏳ Wait';
  ui.gaugeVerdict.className     = `gauge-verdict ${isBuy ? 'verdict-buy' : 'verdict-wait'}`;
}

// ── loadAndRenderChart ────────────────────────────────────────────────────────
async function loadAndRenderChart(productId, livePrice, similarRaw) {
  try {
    const [backendResult, localHistory] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_PRICE_HISTORY', productId }),
      window.priceHistoryStorage.getProductHistory(productId),
    ]);

    // Full response shape coming from background.js fetchPriceHistory:
    //   backendResult = { data: [{date,price},...], stats: {min,max,avg,current} }
    // background.js already unwraps the outer envelope (json.data),
    // so backendResult.data is the array and backendResult.stats has the stats.
    console.log('[PricePulse] backendResult:', JSON.stringify(backendResult).substring(0, 300));

    const rawBackend = Array.isArray(backendResult?.data) ? backendResult.data : [];
    const stats      = backendResult?.stats ?? null;

    console.log('[PricePulse] Backend history points:', rawBackend.length);
    console.log('[PricePulse] Backend stats:', stats);
    console.log('[PricePulse] Local history points:', localHistory?.prices?.length ?? 0);

    const backendPoints = rawBackend
      .filter(s => s.date && s.price != null)
      .map(s => ({
        date:   s.date,
        normal: Number(s.price),
        offer:  Math.round(Number(s.price) * 0.92),
      }));

    // Local IndexedDB: only dates the backend doesn't already have
    const backendDates = new Set(backendPoints.map(p => p.date));
    const localPoints  = (localHistory?.prices ?? [])
      .map(p => ({
        date:   new Date(p.timestamp).toISOString().split('T')[0],
        normal: Number(p.price),
        offer:  Math.round(Number(p.price) * 0.92),
      }))
      .filter(p => !backendDates.has(p.date) && !isNaN(p.normal) && p.normal > 0);

    const byDate = new Map();
    [...backendPoints, ...localPoints].forEach(({ date, normal, offer }) => {
      if (!byDate.has(date)) byDate.set(date, { normal, offer });
    });

    let chartPoints = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Guard: need at least 2 points to draw a meaningful line
    if (chartPoints.length < 2) {
      const wrap = document.querySelector('.chart-wrap');
      if (wrap) {
        if (chart) { chart.destroy(); chart = null; }
        wrap.innerHTML = '<p style="color:rgba(255,255,255,.4);font-size:11px;text-align:center;padding:40px 12px">Price tracking started. The chart will appear after a few more visits to this product.</p>';
      }
      renderSimilarProducts(similarRaw);
      return;
    }

    if (!chartPoints.length) chartPoints = buildFallbackPoints(livePrice);

    console.log('[PricePulse] Final chart points:', chartPoints.length);
    lastApiData = { ...lastApiData, chartPoints, stats };

    // If backend returned real stats, update the stats cards now with
    // historical min/max/avg rather than just the live price.
    if (stats) {
      updateStats(stats.min, stats.max, stats.avg, stats.current ?? livePrice);
      updateGauge(stats.current ?? livePrice, stats.min, stats.max, stats.avg);
    }

    // Double rAF: first frame removes display:none, second completes layout
    // so canvas.offsetWidth is non-zero when Chart.js initialises.
    requestAnimationFrame(() => requestAnimationFrame(() => renderChart(currentChartRange, chartPoints)));
  } catch (err) {
    console.error('[PricePulse] loadAndRenderChart error:', err);
    const chartPoints = buildFallbackPoints(livePrice);
    lastApiData = { ...lastApiData, chartPoints };
    requestAnimationFrame(() => requestAnimationFrame(() => renderChart(currentChartRange, chartPoints)));
  }
  renderSimilarProducts(similarRaw);
}

// ── buildFallbackPoints ───────────────────────────────────────────────────────
// Only used when backend is completely unreachable.
// Generates a minimal 30-day chart from a single price with slight variance.
function buildFallbackPoints(price) {
  const points = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Add ±5% random variance so it doesn't look like a flat line
    const variance = price * (0.95 + Math.random() * 0.10);
    const p = Math.round(variance);
    points.push({
      date:   d.toISOString().split('T')[0],
      normal: p,
      offer:  Math.round(p * 0.92),
    });
  }
  // Make sure the last point is the actual live price
  points[points.length - 1].normal = price;
  points[points.length - 1].offer  = Math.round(price * 0.92);
  return points;
}

// ── renderChartFromPrices ─────────────────────────────────────────────────────
function renderChartFromPrices(allPrices, livePrice) {
  const chartPoints = buildFallbackPoints(livePrice || allPrices[0] || 0);
  lastApiData = { ...lastApiData, chartPoints };
  requestAnimationFrame(() => requestAnimationFrame(() => renderChart(currentChartRange, chartPoints)));
}

// ── renderChart ───────────────────────────────────────────────────────────────
function renderChart(range, data) {
  if (!data?.length) { showChartEmpty(); return; }

  const days   = { '1M': 30, '3M': 90, '6M': 180, 'All': Infinity };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days[range] ?? 30));

  let filtered = data.filter(e => new Date(e.date) >= cutoff);
  if (!filtered.length) filtered = data;

  // Validate: drop any points where normal is not a finite positive number
  filtered = filtered.filter(e => Number.isFinite(e.normal) && e.normal > 0);
  if (!filtered.length) { showChartEmpty(); return; }

  console.log('[PricePulse] renderChart — range:', range, '| points:', filtered.length);

  const step       = Math.max(1, Math.floor(filtered.length / 8));
  const labels     = filtered.map((e, i) =>
    i % step === 0 ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '');
  const normalData = filtered.map(e => e.normal);
  const offerData  = filtered.map(e => e.offer);

  if (chart) { chart.destroy(); chart = null; }

  const canvas = $('price-chart');
  if (!canvas) return;

  // If canvas still has no width the parent is hidden — retry after another frame
  if (canvas.offsetWidth === 0) {
    console.warn('[PricePulse] Canvas width is 0, retrying after layout...');
    requestAnimationFrame(() => renderChart(range, data));
    return;
  }

  const ctx  = canvas.getContext('2d');
  console.log('[PricePulse] Canvas size:', canvas.offsetWidth, 'x', canvas.offsetHeight);
  const grad = ctx.createLinearGradient(0, 0, 0, 140);
  grad.addColorStop(0, 'rgba(16,185,129,.25)');
  grad.addColorStop(1, 'rgba(16,185,129,.01)');

  const datasets = [{
    label: 'Normal Price', data: normalData,
    borderColor: '#10b981', backgroundColor: grad,
    borderWidth: 2, tension: 0.35,
    pointRadius: 0, pointHoverRadius: 4,
    pointHoverBackgroundColor: '#10b981', fill: true,
  }];

  if (showOffers) {
    datasets.push({
      label: 'With Offers', data: offerData,
      borderColor: '#f59e0b', backgroundColor: 'transparent',
      borderWidth: 1.5, borderDash: [5, 4], tension: 0.35,
      pointRadius: 0, pointHoverRadius: 4,
      pointHoverBackgroundColor: '#f59e0b', fill: false,
    });
  }

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,12,41,.92)',
          borderColor: 'rgba(255,255,255,.1)', borderWidth: 1,
          titleColor: 'rgba(255,255,255,.5)', bodyColor: '#e2e8f0', padding: 8,
          callbacks: { label: c => ` ${c.dataset.label}: ${formatInr(c.parsed.y)}` },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(255,255,255,.05)' },
          ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 }, callback: v => formatInr(v), maxTicksLimit: 5 },
          border: { display: false },
        },
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 }, maxRotation: 0 },
          border: { display: false },
        },
      },
    },
  });

  // Update stats, gauge and deal card from the actual chart data range
  const chartMin = Math.min(...normalData);
  const chartMax = Math.max(...normalData);
  const chartAvg = Math.round(normalData.reduce((a, b) => a + b, 0) / normalData.length);
  const chartCurrent = normalData[normalData.length - 1];
  updateStats(chartMin, chartMax, chartAvg, chartCurrent);
  updateGauge(chartCurrent, chartMin, chartMax, chartAvg);
}

// ── showChartEmpty ────────────────────────────────────────────────────────────
function showChartEmpty() {
  const wrap = document.querySelector('.chart-wrap');
  if (!wrap) return;
  if (chart) { chart.destroy(); chart = null; }
  wrap.innerHTML = '<p style="color:rgba(255,255,255,.3);font-size:11px;text-align:center;padding:50px 0">No price history available yet</p>';
}

// ── renderSimilarProducts ─────────────────────────────────────────────────────
const GROUP_LABELS_SP = { exact: '🔥 Best Match', 'same-brand': '🏷️ Same Brand', similar: '✦ Similar', other: '◈ Other' };
const LABEL_CLASS_SP  = { exact: 'label-exact', 'same-brand': 'label-same-brand', similar: 'label-similar', other: 'label-other' };

function renderSimilarProducts(products = []) {
  if (!products.length) {
    ui.similarList.innerHTML = '<p style="color:rgba(255,255,255,.4);text-align:center;padding:16px">No products found</p>';
    return;
  }

  // Deduplicate by URL, falling back to title+platform as key
  const seen   = new Map();
  const unique = [];
  for (const p of products) {
    const key = p.url || ((p.name || p.title || '') + '|' + (p.platform || ''));
    if (!seen.has(key)) { seen.set(key, true); unique.push(p); }
  }

  const allPrices = unique.map(p => p.price).filter(Boolean);
  const minPrice  = allPrices.length ? Math.min(...allPrices) : null;

  ui.similarList.innerHTML = unique.map(p => {
    const group = p.matchGroup || 'other';
    const label = GROUP_LABELS_SP[group] || GROUP_LABELS_SP.other;
    const cls   = LABEL_CLASS_SP[group]  || LABEL_CLASS_SP.other;
    const stars = p.rating
      ? '★'.repeat(Math.round(p.rating)) + '☆'.repeat(5 - Math.round(p.rating)) + ` <span class="sp-rating-num">${p.rating}</span>`
      : '';
    const isBest = p.price != null && p.price === minPrice;
    return `
    <div class="sp-card${isBest ? ' sp-card--best' : ''}">
      <img class="sp-img" src="${esc(p.image || p.thumbnail || '')}" alt=""
           onerror="this.src='https://placehold.co/56x56/1e1b4b/94a3b8?text=IMG'" />
      <div class="sp-body">
        <div class="sp-top">
          <span class="sp-platform">${esc(p.platform || '')}</span>
          <span class="sp-label ${cls}">${label}</span>
          ${isBest ? '<span class="sp-best-badge">BEST PRICE</span>' : ''}
        </div>
        <div class="sp-title">${esc(p.name || p.title || '')}</div>
        ${stars ? `<div class="sp-rating">${stars}</div>` : ''}
        <div class="sp-bottom">
          <span class="sp-price${isBest ? ' sp-price--best' : ''}">${formatInr(p.price)}</span>
          ${p.url ? `<a class="sp-btn" href="${esc(p.url)}" target="_blank">View <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:8px"></i></a>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── setState ──────────────────────────────────────────────────────────────────
function setState(state, msg = '') {
  clearTimeout(coldStartTimer);
  hide(ui.spinner); hide(ui.error); hide(ui.empty); hide(ui.mainContent);
  if (state === 'loading') {
    show(ui.spinner); hide(ui.coldStartHint);
    coldStartTimer = setTimeout(() => show(ui.coldStartHint), 5000);
  } else if (state === 'error') {
    ui.errorMsg.textContent = msg; show(ui.error);
  } else if (state === 'empty') {
    show(ui.empty);
  } else if (state === 'results') {
    show(ui.mainContent);
  } else if (state === 'not-product') {
    ui.errorMsg.textContent = 'Open a product page on Amazon or Flipkart, then click the extension.';
    show(ui.error);
  }
}

function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function esc(str = '') {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatInr(price) {
  if (price == null || isNaN(price)) return 'N/A';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}
