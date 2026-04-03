// ============================================================
// extension/popup.js — Main popup controller
// ============================================================
// Depends on (loaded before this file):
//   Chart.js, priceHistoryStorage.js, priceTracker.js
// ============================================================

const $ = (id) => document.getElementById(id);

// ── DOM refs ──────────────────────────────────────────────────────────────────
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
  results:       $('results'),
  liveTitle:     $('live-results-title'),
  // Stats
  statHighest:   $('stat-highest'),
  statLowest:    $('stat-lowest'),
  statAverage:   $('stat-average'),
  statCurrent:   $('stat-current'),
  // Deal
  dealCurrentPrice: $('deal-current-price'),
  dealOldPrice:     $('deal-old-price'),
  dealSavings:      $('deal-savings-amount'),
  dealLink:         $('deal-link'),
  // Gauge
  gaugeFill:    $('gauge-fill'),
  gaugeScore:   $('gauge-score'),
  gaugeVerdict: $('gauge-verdict'),
  // Toggle
  toggleOffers: $('toggle-offers'),
  // Similar
  similarList:  $('similar-list'),
};

let currentQuery     = '';
let currentProductId = null;
let chart            = null;
let coldStartTimer   = null;
let showOffers       = true;   // controlled by the toggle

// ── Dummy price history data (all time) ──────────────────────────────────────
// Each entry: { date: 'YYYY-MM-DD', normal: price, offer: price }
const DUMMY_HISTORY = (() => {
  const base = 28999;
  const entries = [];
  const now = new Date();
  for (let i = 179; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split('T')[0];
    // Simulate realistic price fluctuation
    const wave    = Math.sin(i / 20) * 1800;
    const noise   = (Math.random() - 0.5) * 600;
    const normal  = Math.round(base + wave + noise);
    const offer   = Math.round(normal * (0.88 + Math.random() * 0.05)); // 5–12% off
    entries.push({ date: dateKey, normal, offer });
  }
  return entries;
})();

// ── Dummy similar products ────────────────────────────────────────────────────
const DUMMY_SIMILAR = [
  {
    title:    'Samsung Galaxy S23 FE 5G',
    platform: 'Flipkart',
    price:    34999,
    image:    'https://placehold.co/80x80/1e3a5f/93c5fd?text=S23',
    url:      'https://www.flipkart.com',
  },
  {
    title:    'OnePlus 12R 5G 128GB',
    platform: 'Amazon',
    price:    29999,
    image:    'https://placehold.co/80x80/1e3a2f/6ee7b7?text=OP12',
    url:      'https://www.amazon.in',
  },
  {
    title:    'Motorola Edge 40 Neo',
    platform: 'Amazon',
    price:    23999,
    image:    'https://placehold.co/80x80/2d1b4e/c4b5fd?text=Moto',
    url:      'https://www.amazon.in',
  },
  {
    title:    'iQOO Z9 5G 8GB/128GB',
    platform: 'Flipkart',
    price:    18999,
    image:    'https://placehold.co/80x80/3b1f1f/fca5a5?text=iQOO',
    url:      'https://www.flipkart.com',
  },
  {
    title:    'Realme 12 Pro+ 5G',
    platform: 'Flipkart',
    price:    26999,
    image:    'https://placehold.co/80x80/1f2d3b/93c5fd?text=RM12',
    url:      'https://www.flipkart.com',
  },
  {
    title:    'Nothing Phone (2a)',
    platform: 'Flipkart',
    price:    23999,
    image:    'https://placehold.co/80x80/1a1a2e/e2e8f0?text=NP2a',
    url:      'https://www.flipkart.com',
  },
];

// ── Boot ──────────────────────────────────────────────────────────────────────
(async () => {
  const { title, url } = await getPageInfo();
  if (title) {
    currentQuery     = title;
    currentProductId = window.generateProductId(url, title);
    ui.productName.textContent = title;
    ui.searchInput.value       = title;
    show(ui.productBar);
    await search(title);
  }
})();

// ── Events ────────────────────────────────────────────────────────────────────
ui.btnSearch.addEventListener('click', () => {
  const q = ui.searchInput.value.trim();
  if (!q) return;
  currentQuery     = q;
  currentProductId = window.generateProductId(null, q);
  search(q);
});

ui.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ui.btnSearch.click();
});

ui.btnRefresh.addEventListener('click', () => {
  if (currentQuery) {
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE', query: currentQuery });
    search(currentQuery);
  }
});

// Toggle: re-render chart when "Show Best Offers" is switched
ui.toggleOffers.addEventListener('change', () => {
  showOffers = ui.toggleOffers.checked;
  renderChart(currentChartRange);
});

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Chart filter buttons ──────────────────────────────────────────────────────
let currentChartRange = '1M';

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentChartRange = btn.dataset.range;
    renderChart(currentChartRange);
  });
});

// ── getPageInfo ───────────────────────────────────────────────────────────────
async function getPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { title: null, url: null };
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const SELECTORS = [
          '#productTitle', '#title span',
          'span.B_NuCI', 'h1.yhB1nd span',
          'h1.x-item-title__mainTitle span', '#itemTitle',
          'h1[data-buy-box-listing-title]', 'h1.wt-text-body-03',
          'h1.pdp-title', 'h1.pdp-e-i-head', 'h1',
        ];
        for (const sel of SELECTORS) {
          const t = document.querySelector(sel)?.innerText?.trim();
          if (t && t.length > 2) return t;
        }
        return null;
      },
    });
    return { title: result || null, url: tab.url };
  } catch {
    return { title: null, url: null };
  }
}

// ── search ────────────────────────────────────────────────────────────────────
async function search(query) {
  setState('loading');
  try {
    const data = await chrome.runtime.sendMessage({ type: 'SEARCH_PRODUCTS', query });
    if (data?.error) throw new Error(data.error);
    render(data);
  } catch (err) {
    console.error('[PricePulse] Search failed:', err);
    setState('error', err.message || 'Could not reach the backend. It may be waking up — please try again.');
  }
}

// ── render ────────────────────────────────────────────────────────────────────
function render({ products, meta, fromCache }) {
  if (!products?.length) { setState('empty'); return; }

  setState('results');

  // ── Meta bar ──
  const fetchedAt = meta?.fetchedAt ? new Date(meta.fetchedAt) : new Date();
  const timeStr   = fetchedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  ui.metaBar.innerHTML =
    `${fromCache
      ? '<span class="badge badge-cache">⚡ Cached</span>'
      : '<span class="badge badge-live">🟢 Live</span>'}
     <span class="updated-at">Updated ${timeStr}</span>`;

  // ── Price stats from live results ──
  const prices  = products.map((p) => p.price).filter(Boolean);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const current  = prices[0] ?? minPrice;

  updateStats(minPrice, maxPrice, avgPrice, current);
  updateDealCard(minPrice, maxPrice, products);
  updateGauge(current, minPrice, maxPrice, avgPrice);

  // ── Live results list ──
  const GROUP_ORDER  = ['exact', 'same-brand', 'similar', 'other'];
  const GROUP_LABELS = {
    'exact':      '🔥 Best Match',
    'same-brand': '🏷️ Same Brand',
    'similar':    '✦ Similar Products',
    'other':      '◈ Other Alternatives',
  };
  const LABEL_CLASS = {
    'exact': 'label-exact', 'same-brand': 'label-same-brand',
    'similar': 'label-similar', 'other': 'label-other',
  };

  const groups = {};
  for (const p of products) {
    const g = GROUP_ORDER.includes(p.matchGroup) ? p.matchGroup : 'other';
    (groups[g] = groups[g] || []).push(p);
  }

  const partialMsg = meta?.partialErrors?.length
    ? `<p class="partial-warn">⚠ Partial results — ${meta.partialErrors.join('; ')}</p>` : '';

  let html = partialMsg;
  for (const group of GROUP_ORDER) {
    if (!groups[group]?.length) continue;
    html += `<div class="result-section"><div class="section-header">${GROUP_LABELS[group]}</div>`;
    for (const p of groups[group]) {
      const isCheapest = p.price === minPrice;
      const stars = p.rating
        ? `${'★'.repeat(Math.round(p.rating))}${'☆'.repeat(5 - Math.round(p.rating))} ${p.rating}` : '';
      html += `
        <div class="card ${isCheapest ? 'cheapest' : ''}">
          <div class="card-body">
            <div class="card-top">
              <span class="card-platform">${esc(p.platform)}</span>
              <span class="card-label ${LABEL_CLASS[group]}">${GROUP_LABELS[group]}</span>
              ${isCheapest ? '<span class="card-badge">BEST PRICE</span>' : ''}
            </div>
            <div class="card-title">${esc(p.name || p.title || '')}</div>
            ${stars ? `<div class="card-rating">${stars}</div>` : ''}
          </div>
          <div class="card-right">
            <div class="card-price">${formatInr(p.price)}</div>
            ${p.url ? `<a class="card-link" href="${esc(p.url)}" target="_blank">View →</a>` : ''}
          </div>
        </div>`;
    }
    html += '</div>';
  }

  ui.results.innerHTML = html;
  show(ui.liveTitle);

  // ── Price history chart (merge backend + local) ──
  if (currentProductId && currentQuery) {
    window.trackProductPrice({ productId: currentProductId, title: currentQuery, currentPrice: minPrice });
    chrome.runtime.sendMessage({
      type: 'RECORD_PRICE_SNAPSHOT', productId: currentProductId, title: currentQuery, price: minPrice,
    });
    loadAndRenderChart(currentProductId);
  } else {
    // No real history yet — use dummy data
    renderChart(currentChartRange);
  }

  // ── Similar products (dummy) ──
  renderSimilarProducts();
}

// ── updateStats ───────────────────────────────────────────────────────────────
function updateStats(min, max, avg, current) {
  ui.statHighest.textContent = formatInr(max);
  ui.statLowest.textContent  = formatInr(min);
  ui.statAverage.textContent = formatInr(avg);
  ui.statCurrent.textContent = formatInr(current);
}

// ── updateDealCard ────────────────────────────────────────────────────────────
function updateDealCard(minPrice, maxPrice, products) {
  const bestProduct = products.find((p) => p.price === minPrice) || products[0];
  const savings     = maxPrice - minPrice;
  const savingsPct  = Math.round((savings / maxPrice) * 100);

  ui.dealCurrentPrice.textContent = formatInr(minPrice);
  ui.dealOldPrice.textContent     = formatInr(maxPrice);
  ui.dealSavings.textContent      = `${formatInr(savings)} (${savingsPct}% off)`;
  ui.dealLink.href                = bestProduct?.url || '#';
}

// ── updateGauge ───────────────────────────────────────────────────────────────
// Score 0–100: higher = better time to buy
// Logic: if current ≤ avg → good deal (score 60–90), else wait (score 20–50)
function updateGauge(current, min, max, avg) {
  const range = max - min || 1;
  // Normalise: 100 = at all-time low, 0 = at all-time high
  const rawScore = Math.round(((max - current) / range) * 100);
  const score    = Math.max(5, Math.min(95, rawScore));
  const isBuy    = score >= 55;

  ui.gaugeFill.style.width      = `${score}%`;
  ui.gaugeFill.style.background = isBuy
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : 'linear-gradient(90deg, #ef4444, #f97316)';

  ui.gaugeScore.textContent = `${score}/100`;
  ui.gaugeVerdict.textContent = isBuy ? '✓ Buy Now' : '⏳ Wait';
  ui.gaugeVerdict.className   = `gauge-verdict ${isBuy ? 'verdict-buy' : 'verdict-wait'}`;
}

// ── loadAndRenderChart ────────────────────────────────────────────────────────
// Tries to load real history; falls back to dummy data
async function loadAndRenderChart(productId) {
  try {
    const [backendResult, localHistory] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_PRICE_HISTORY', productId }),
      window.priceHistoryStorage.getProductHistory(productId),
    ]);

    const backendPoints = (backendResult?.data ?? []).map((s) => ({
      date: s.date, normal: s.price, offer: Math.round(s.price * 0.92),
    }));
    const localPoints = (localHistory?.prices ?? []).map((p) => ({
      date:   new Date(p.timestamp).toISOString().split('T')[0],
      normal: p.price,
      offer:  Math.round(p.price * 0.92),
    }));

    const byDate = new Map();
    [...localPoints, ...backendPoints].forEach(({ date, normal, offer }) => {
      byDate.set(date, { normal, offer });
    });

    const merged = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));

    // Use real data if we have enough points, otherwise fall back to dummy
    renderChart(currentChartRange, merged.length >= 2 ? merged : null);
  } catch {
    renderChart(currentChartRange);
  }
}

// ── renderChart ───────────────────────────────────────────────────────────────
// @param range  — '1M' | '3M' | '6M' | 'All'
// @param data   — array of { date, normal, offer } or null (uses DUMMY_HISTORY)
function renderChart(range, data = null) {
  const source = data || DUMMY_HISTORY;

  // Filter by range
  const cutoff = new Date();
  const days   = { '1M': 30, '3M': 90, '6M': 180, 'All': Infinity };
  cutoff.setDate(cutoff.getDate() - (days[range] ?? 30));

  const filtered = source.filter((e) => new Date(e.date) >= cutoff);
  if (!filtered.length) return;

  // Thin labels for readability (show at most ~8 labels)
  const step   = Math.max(1, Math.floor(filtered.length / 8));
  const labels = filtered.map((e, i) =>
    i % step === 0
      ? new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : ''
  );

  const normalData = filtered.map((e) => e.normal);
  const offerData  = filtered.map((e) => e.offer);

  if (chart) { chart.destroy(); chart = null; }

  const ctx = $('price-chart').getContext('2d');

  // Gradient fill for normal price line
  const grad = ctx.createLinearGradient(0, 0, 0, 140);
  grad.addColorStop(0, 'rgba(16,185,129,.25)');
  grad.addColorStop(1, 'rgba(16,185,129,.01)');

  const datasets = [
    {
      label:                'Normal Price',
      data:                 normalData,
      borderColor:          '#10b981',
      backgroundColor:      grad,
      borderWidth:          2,
      tension:              0.35,
      pointRadius:          0,
      pointHoverRadius:     4,
      pointHoverBackgroundColor: '#10b981',
      fill:                 true,
    },
  ];

  // Only add offer line when toggle is ON
  if (showOffers) {
    datasets.push({
      label:           'With Offers',
      data:            offerData,
      borderColor:     '#f59e0b',
      backgroundColor: 'transparent',
      borderWidth:     1.5,
      borderDash:      [5, 4],
      tension:         0.35,
      pointRadius:     0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#f59e0b',
      fill:            false,
    });
  }

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction:         { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,12,41,.92)',
          borderColor:     'rgba(255,255,255,.1)',
          borderWidth:     1,
          titleColor:      'rgba(255,255,255,.5)',
          bodyColor:       '#e2e8f0',
          padding:         8,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatInr(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid:  { color: 'rgba(255,255,255,.05)' },
          ticks: {
            color:    'rgba(255,255,255,.3)',
            font:     { size: 9 },
            callback: (val) => formatInr(val),
            maxTicksLimit: 5,
          },
          border: { display: false },
        },
        x: {
          grid:  { display: false },
          ticks: { color: 'rgba(255,255,255,.3)', font: { size: 9 }, maxRotation: 0 },
          border: { display: false },
        },
      },
    },
  });

  // Update stats from chart data
  const allNormal = normalData;
  updateStats(
    Math.min(...allNormal),
    Math.max(...allNormal),
    Math.round(allNormal.reduce((a, b) => a + b, 0) / allNormal.length),
    allNormal[allNormal.length - 1]
  );
  updateDealCard(
    Math.min(...allNormal),
    Math.max(...allNormal),
    [{ price: Math.min(...allNormal), url: '#' }]
  );
  updateGauge(
    allNormal[allNormal.length - 1],
    Math.min(...allNormal),
    Math.max(...allNormal),
    Math.round(allNormal.reduce((a, b) => a + b, 0) / allNormal.length)
  );
}

// ── renderSimilarProducts ─────────────────────────────────────────────────────
function renderSimilarProducts() {
  ui.similarList.innerHTML = DUMMY_SIMILAR.map((p) => `
    <div class="similar-card">
      <img class="similar-img" src="${esc(p.image)}" alt="${esc(p.title)}"
           onerror="this.src='https://placehold.co/80x80/1e1b4b/94a3b8?text=IMG'" />
      <div class="similar-info">
        <div class="similar-title">${esc(p.title)}</div>
        <div class="similar-platform">${esc(p.platform)}</div>
        <div class="similar-price">${formatInr(p.price)}</div>
      </div>
      <a class="similar-btn" href="${esc(p.url)}" target="_blank">
        View <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:9px"></i>
      </a>
    </div>
  `).join('');
}

// ── setState ──────────────────────────────────────────────────────────────────
function setState(state, msg = '') {
  clearTimeout(coldStartTimer);
  hide(ui.spinner);
  hide(ui.error);
  hide(ui.empty);
  hide(ui.mainContent);
  hide(ui.liveTitle);

  if (state === 'loading') {
    show(ui.spinner);
    hide(ui.coldStartHint);
    coldStartTimer = setTimeout(() => show(ui.coldStartHint), 5000);
  } else if (state === 'error') {
    ui.errorMsg.textContent = msg;
    show(ui.error);
  } else if (state === 'empty') {
    show(ui.empty);
  } else if (state === 'results') {
    show(ui.mainContent);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatInr(price) {
  if (price == null || isNaN(price)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(price);
}
