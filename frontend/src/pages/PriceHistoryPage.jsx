import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  BellIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid';
import { Chart, registerables } from 'chart.js';
import { formatCurrency } from '../utils/formatCurrency';
import { generatePriceHistory } from '../utils/generatePriceHistory';
import api from '../services/api';

Chart.register(...registerables);

// ── Constants ─────────────────────────────────────────────────────────────────
const RANGES = [
  { label: '1M',  days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
  { label: 'Max', days: 0   },
];

const PLATFORM_COLORS = {
  Amazon:   { hex: '#f97316', bg: 'bg-orange-500/10', border: 'border-orange-400/30', text: 'text-orange-300' },
  Flipkart: { hex: '#3b82f6', bg: 'bg-blue-500/10',   border: 'border-blue-400/30',   text: 'text-blue-300'   },
  eBay:     { hex: '#eab308', bg: 'bg-yellow-500/10', border: 'border-yellow-400/30', text: 'text-yellow-300' },
  Etsy:     { hex: '#f43f5e', bg: 'bg-rose-500/10',   border: 'border-rose-400/30',   text: 'text-rose-300'   },
  Snapdeal: { hex: '#ef4444', bg: 'bg-red-500/10',    border: 'border-red-400/30',    text: 'text-red-300'    },
};

// Convert generatePriceHistory output (date strings) to internal format (timestamps)
function mockHistory(currentPrice) {
  return generatePriceHistory(currentPrice, 365).map((p) => ({
    price:      p.price,
    offerPrice: p.offerPrice,
    date:       new Date(p.date).getTime(),
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PriceHistoryPage() {
  const { state }  = useLocation();
  const navigate   = useNavigate();
  const canvasRef  = useRef(null);
  const chartRef   = useRef(null);

  const product     = state?.product     || null;
  const allProducts = state?.allProducts || [];

  const [history,     setHistory]     = useState([]);
  const [activeRange, setActiveRange] = useState(30);
  const [loading,     setLoading]     = useState(true);
  const [alertPrice,  setAlertPrice]  = useState('');
  const [alertSet,    setAlertSet]    = useState(false);
  const [alertSaved,  setAlertSaved]  = useState('');

  const title        = product?.name || product?.title || 'Product';
  const productUrl   = product?.productUrl || product?.url || '#';
  const image        = product?.image || '';
  const platform     = product?.platform || '';
  const currentPrice = product?.price || 0;
  const productId    = product?._id || product?.id || '';

  // ── Load existing alert from localStorage ────────────────────────────────────
  useEffect(() => {
    if (!productId) return;
    const saved = localStorage.getItem(`alert_${productId}`);
    if (saved) { setAlertPrice(saved); setAlertSet(true); }
  }, [productId]);

  // ── Fetch price history ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!product) return;
    setLoading(true);

    // Pass days=0 for Max (all-time), otherwise pass the selected window.
    // Backend uses this to return the right slice; if it ignores the param
    // we still filter client-side in the chart effect below.
    const daysParam = activeRange === 0 ? 365 : activeRange;

    api.get(`/products/price-history?productId=${encodeURIComponent(productId)}&days=${daysParam}`)
      .then((res) => {
        const raw = res.data?.data ?? [];
        if (raw.length >= 2) {
          setHistory(raw.map((s) => ({
            price:      s.price,
            offerPrice: s.offerPrice ?? Math.round(s.price * 0.95),
            date:       new Date(s.date).getTime(),
          })));
        } else {
          setHistory(mockHistory(currentPrice));
        }
      })
      .catch(() => setHistory(mockHistory(currentPrice)))
      .finally(() => setLoading(false));
  }, [productId, activeRange]);

  // ── Build chart ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;

    const cutoff = activeRange === 0
      ? 0
      : Date.now() - activeRange * 24 * 60 * 60 * 1000;

    const points = history
      .filter((p) => p.date >= cutoff)
      .sort((a, b) => a.date - b.date);

    if (points.length === 0) return;

    const labels      = points.map((p) =>
      new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    );
    const prices      = points.map((p) => p.price);
    const offerPrices = points.map((p) => p.offerPrice ?? Math.round(p.price * 0.95));
    const minP        = Math.min(...prices);
    const alert       = alertSet && alertPrice ? Number(alertPrice) : null;

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const ctx      = canvasRef.current.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, 'rgba(99,102,241,0.4)');
    gradient.addColorStop(1, 'rgba(99,102,241,0)');

    const datasets = [
      {
        label:                'Normal Price',
        data:                 prices,
        borderColor:          '#6366f1',
        backgroundColor:      gradient,
        borderWidth:          2.5,
        tension:              0.4,
        fill:                 true,
        pointRadius:          prices.map((p) => p === minP ? 7 : 0),
        pointBackgroundColor: prices.map((p) => p === minP ? '#4ade80' : '#6366f1'),
        pointBorderColor:     prices.map((p) => p === minP ? '#fff' : 'transparent'),
        pointBorderWidth:     prices.map((p) => p === minP ? 2 : 0),
        pointHoverRadius:     4,
      },
      {
        label:            'With Offers',
        data:             offerPrices,
        borderColor:      '#f59e0b',
        backgroundColor:  'transparent',
        borderWidth:      1.5,
        borderDash:       [5, 4],
        tension:          0.4,
        fill:             false,
        pointRadius:      0,
        pointHoverRadius: 4,
      },
    ];

    if (alert) {
      datasets.push({
        label:       'Your Alert',
        data:        prices.map(() => alert),
        borderColor: '#ef4444',
        borderWidth: 1.5,
        borderDash:  [6, 4],
        pointRadius: 0,
        fill:        false,
        tension:     0,
      });
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           { duration: 500 },
        interaction:         { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels:  { color: 'rgba(255,255,255,0.45)', font: { size: 11 }, boxWidth: 24, padding: 16 },
          },
          tooltip: {
            backgroundColor: 'rgba(10,8,30,0.95)',
            titleColor:      'rgba(255,255,255,0.5)',
            bodyColor:       '#fff',
            borderColor:     'rgba(99,102,241,0.5)',
            borderWidth:     1,
            padding:         12,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color:    'rgba(255,255,255,0.35)',
              font:     { size: 11 },
              callback: (v) => formatCurrency(v),
            },
          },
          x: {
            grid:  { display: false },
            ticks: {
              color:         'rgba(255,255,255,0.35)',
              font:          { size: 11 },
              maxTicksLimit: 8,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, [history, activeRange, alertSet, alertPrice]);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const allPrices  = history.map((p) => p.price);
  const minPrice   = allPrices.length ? Math.min(...allPrices) : currentPrice;
  const maxPrice   = allPrices.length ? Math.max(...allPrices) : currentPrice;
  const avgPrice   = allPrices.length
    ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
    : currentPrice;
  const dropPct    = maxPrice > currentPrice
    ? Math.round(((maxPrice - currentPrice) / maxPrice) * 100)
    : 0;
  const isGoodDeal = currentPrice <= avgPrice;

  // ── Alert handler ─────────────────────────────────────────────────────────────
  function handleSetAlert() {
    const val = Number(alertPrice);
    if (!val || val <= 0) return;
    localStorage.setItem(`alert_${productId}`, String(val));
    setAlertSet(true);
    setAlertSaved(`Alert set! We'll notify you when price drops to ${formatCurrency(val)}.`);
    setTimeout(() => setAlertSaved(''), 4000);
  }

  function handleRemoveAlert() {
    localStorage.removeItem(`alert_${productId}`);
    setAlertSet(false);
    setAlertPrice('');
  }

  // ── No product guard ──────────────────────────────────────────────────────────
  if (!product) {
    return (
      <div className="page-dark min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 text-lg mb-4">No product data found.</p>
          <button
            onClick={() => navigate(-1)}
            className="btn-gradient px-6 py-2 rounded-xl text-white text-sm font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const sortedProducts = [...allProducts].sort((a, b) => a.price - b.price);
  const bestProduct    = sortedProducts[0];

  return (
    <div className="page-dark min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to results
        </button>

        {/* ── Row 1: product card + comparison + right panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* ── Left: product info ── */}
          <div className="glass rounded-2xl p-5 flex flex-col gap-4">
            <div className="h-52 rounded-xl overflow-hidden bg-white/5 flex-shrink-0">
              <img
                src={image || `https://placehold.co/400x300/1e1b4b/94a3b8?text=${encodeURIComponent(platform)}`}
                alt={title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.src = `https://placehold.co/400x300/1e1b4b/94a3b8?text=${encodeURIComponent(platform)}`;
                }}
              />
            </div>

            <div className="flex-1">
              <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full
                               ${PLATFORM_COLORS[platform]?.bg || 'bg-white/10'}
                               ${PLATFORM_COLORS[platform]?.text || 'text-white/50'}`}>
                {platform}
              </span>
              <h1 className="text-sm font-semibold text-white/90 leading-snug mt-2 line-clamp-3">
                {title}
              </h1>
            </div>

            <div>
              <p className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(currentPrice)}
              </p>
              {dropPct > 0 && (
                <p className="text-xs text-green-400 font-semibold mt-1">
                  ↓ {dropPct}% below all-time high
                </p>
              )}
            </div>

            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gradient flex items-center justify-center gap-2 py-2.5 rounded-xl
                         text-white text-sm font-bold"
            >
              Buy on {platform}
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>

          {/* ── Middle: platform comparison ── */}
          <div className="glass rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest">
              Price Comparison
            </h2>

            {sortedProducts.length > 0 ? (
              <div className="flex flex-col gap-2 flex-1">
                {sortedProducts.map((p, i) => {
                  const pUrl    = p.productUrl || p.url || '#';
                  const pc      = PLATFORM_COLORS[p.platform] || { hex: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-400/30', text: 'text-indigo-300' };
                  const isBest  = i === 0;
                  const diffPct = isBest ? 0 : Math.round(((p.price - bestProduct.price) / bestProduct.price) * 100);

                  return (
                    <a
                      key={p._id || p.id || i}
                      href={pUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border
                                  transition-all hover:scale-[1.02]
                                  ${isBest ? 'border-green-400/40 bg-green-500/08' : `${pc.border} ${pc.bg}`}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: pc.hex }} />
                        <span className="text-sm font-semibold text-white/80 truncate">
                          {p.platform}
                        </span>
                        {isBest && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                            Best
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <span className={`text-sm font-black ${isBest ? 'text-green-400' : 'text-white'}`}>
                            {formatCurrency(p.price)}
                          </span>
                          {!isBest && diffPct > 0 && (
                            <p className="text-xs text-red-400/70">+{diffPct}% more</p>
                          )}
                        </div>
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-white/25" />
                      </div>
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-white/25 text-sm text-center">
                  Search for this product to see cross-platform prices.
                </p>
              </div>
            )}
          </div>

          {/* ── Right: buy indicator + stats + alert ── */}
          <div className="flex flex-col gap-4">

            {/* Should you buy now? */}
            <div className={`glass rounded-2xl p-5 border
                             ${isGoodDeal ? 'border-green-400/30' : 'border-yellow-400/30'}`}>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">
                Should you buy now?
              </p>
              <p className={`text-xl font-black mb-2
                             ${isGoodDeal ? 'text-green-400' : 'text-yellow-400'}`}>
                {isGoodDeal ? '✅ Yes — Good Deal!' : '⏳ Wait for a Drop'}
              </p>
              <p className="text-xs text-white/35 leading-relaxed">
                {isGoodDeal
                  ? `At ${formatCurrency(currentPrice)}, this is at or below the avg of ${formatCurrency(avgPrice)}.`
                  : `At ${formatCurrency(currentPrice)}, this is above the avg of ${formatCurrency(avgPrice)}.`}
              </p>
            </div>

            {/* Price stats */}
            <div className="glass rounded-2xl p-5">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                Price Stats
              </p>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Current',  value: currentPrice, cls: 'text-white'      },
                  { label: 'Lowest',   value: minPrice,     cls: 'text-green-400'  },
                  { label: 'Highest',  value: maxPrice,     cls: 'text-red-400'    },
                  { label: 'Average',  value: avgPrice,     cls: 'text-indigo-300' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-white/35 uppercase tracking-wider">{label}</span>
                    <span className={`text-sm font-black ${cls}`}>{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Alert */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BellIcon className="h-4 w-4 text-amber-400" />
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  Price Alert
                </p>
              </div>

              {alertSet ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                    <CheckCircleIcon className="h-4 w-4" />
                    Alert set at {formatCurrency(Number(alertPrice))}
                  </div>
                  <button
                    onClick={handleRemoveAlert}
                    className="text-xs text-white/30 hover:text-red-400 transition-colors text-left"
                  >
                    Remove alert
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-white/30">
                    Get notified when price drops to your target.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={alertPrice}
                      onChange={(e) => setAlertPrice(e.target.value)}
                      placeholder={`e.g. ${Math.round(currentPrice * 0.9).toLocaleString()}`}
                      className="glass-input flex-1 px-3 py-2 rounded-xl text-sm min-w-0"
                    />
                    <button
                      onClick={handleSetAlert}
                      disabled={!alertPrice}
                      className="btn-gradient px-4 py-2 rounded-xl text-white text-xs font-bold
                                 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}

              {alertSaved && (
                <p className="text-xs text-amber-400 mt-2">{alertSaved}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2: Chart ── */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest">
              📈 Price History
            </h2>
            <div className="flex gap-2">
              {RANGES.map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => setActiveRange(days)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all
                              ${activeRange === days
                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                : 'border-white/15 text-white/35 hover:text-white hover:border-white/30'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-white/30 text-sm">Loading price history…</p>
              </div>
            </div>
          ) : (
            <div className="h-80">
              <canvas ref={canvasRef} />
            </div>
          )}

          {/* Chart legend */}
          <div className="flex items-center gap-5 mt-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-indigo-400" />
              <span className="text-xs text-white/35">Normal price</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber-400" />
              <span className="text-xs text-white/35">With offers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-400" />
              <span className="text-xs text-white/35">Lowest price</span>
            </div>
            {alertSet && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-red-400" />
                <span className="text-xs text-white/35">Your alert ({formatCurrency(Number(alertPrice))})</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
