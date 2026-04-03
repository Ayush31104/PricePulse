import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { Chart, registerables } from 'chart.js';
import { formatCurrency } from '../utils/formatCurrency';
import api from '../services/api';

Chart.register(...registerables);

const RANGES = [
  { label: '1W', days: 7   },
  { label: '1M', days: 30  },
  { label: '3M', days: 90  },
  { label: 'Max', days: 0  },
];

const PLATFORM_COLORS = {
  Amazon:   '#f97316',
  Flipkart: '#3b82f6',
  eBay:     '#eab308',
  Etsy:     '#f43f5e',
  Snapdeal: '#ef4444',
};

export default function PriceHistoryPage() {
  const { state }   = useLocation();
  const navigate    = useNavigate();
  const canvasRef   = useRef(null);
  const chartRef    = useRef(null);

  const product     = state?.product || null;
  const allProducts = state?.allProducts || [];   // same-query results for comparison

  const [history,      setHistory]      = useState([]);
  const [activeRange,  setActiveRange]  = useState(30);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const title      = product?.name || product?.title || 'Product';
  const productUrl = product?.productUrl || product?.url || '#';
  const image      = product?.image || '';
  const platform   = product?.platform || '';
  const currentPrice = product?.price || 0;

  // ── Fetch price history from backend ────────────────────────────────────────
  useEffect(() => {
    if (!product) return;

    const productId = product._id || product.id;

    setLoading(true);
    api.get(`/products/price-history?productId=${encodeURIComponent(productId)}`)
      .then((res) => {
        const raw = res.data?.data ?? [];
        // Normalise to { price, date } with date as timestamp
        const points = raw.map((s) => ({
          price: s.price,
          date:  new Date(s.date).getTime(),
        }));
        // If no backend history, seed with current price so chart isn't empty
        if (points.length === 0) {
          points.push({ price: currentPrice, date: Date.now() });
        }
        setHistory(points);
      })
      .catch(() => {
        // Fallback: show current price as single point
        setHistory([{ price: currentPrice, date: Date.now() }]);
        setError('No price history available yet. Check back later.');
      })
      .finally(() => setLoading(false));
  }, [product]);

  // ── Build chart whenever history or range changes ────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;

    const cutoff = activeRange === 0
      ? 0
      : Date.now() - activeRange * 24 * 60 * 60 * 1000;

    const points = history
      .filter((p) => p.date >= cutoff)
      .sort((a, b) => a.date - b.date);

    if (points.length === 0) return;

    const labels = points.map((p) =>
      new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    );
    const prices = points.map((p) => p.price);
    const minP   = Math.min(...prices);

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const ctx = canvasRef.current.getContext('2d');

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0,   'rgba(99,102,241,0.35)');
    gradient.addColorStop(1,   'rgba(99,102,241,0)');

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data:                 prices,
          borderColor:          '#6366f1',
          backgroundColor:      gradient,
          borderWidth:          2.5,
          tension:              0.4,
          fill:                 true,
          pointRadius:          prices.map((p) => p === minP ? 7 : 3),
          pointBackgroundColor: prices.map((p) => p === minP ? '#4ade80' : '#6366f1'),
          pointBorderWidth:     0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,12,41,0.95)',
            titleColor:      'rgba(255,255,255,0.6)',
            bodyColor:       '#fff',
            borderColor:     'rgba(99,102,241,0.4)',
            borderWidth:     1,
            padding:         10,
            callbacks: {
              label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: false,
            grid:  { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color:    'rgba(255,255,255,0.4)',
              font:     { size: 11 },
              callback: (v) => formatCurrency(v),
            },
          },
          x: {
            grid:  { display: false },
            ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 11 }, maxTicksLimit: 8 },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [history, activeRange]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const prices    = history.map((p) => p.price);
  const minPrice  = prices.length ? Math.min(...prices) : currentPrice;
  const maxPrice  = prices.length ? Math.max(...prices) : currentPrice;
  const avgPrice  = prices.length
    ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    : currentPrice;
  const dropPct   = maxPrice > currentPrice
    ? Math.round(((maxPrice - currentPrice) / maxPrice) * 100)
    : 0;
  const isGoodDeal = currentPrice <= avgPrice;

  if (!product) {
    return (
      <div className="page-dark min-h-screen flex items-center justify-center">
        <div className="text-white/50 text-center">
          <p className="text-lg mb-4">No product data found.</p>
          <button onClick={() => navigate(-1)} className="btn-gradient px-6 py-2 rounded-xl text-white text-sm font-semibold">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-dark min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-medium mb-6 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to results
        </button>

        {/* ── Top section: product info + stats + buy indicator ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Left — product image + title + price */}
          <div className="glass rounded-2xl p-5 flex flex-col gap-4">
            <div className="h-52 rounded-xl overflow-hidden bg-white/5">
              <img
                src={image || `https://placehold.co/400x300/1e1b4b/94a3b8?text=${encodeURIComponent(platform)}`}
                alt={title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.src = `https://placehold.co/400x300/1e1b4b/94a3b8?text=${encodeURIComponent(platform)}`;
                }}
              />
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{platform}</p>
              <h1 className="text-sm font-semibold text-white/90 leading-snug line-clamp-3">{title}</h1>
            </div>
            <div>
              <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(currentPrice)}</p>
              {dropPct > 0 && (
                <p className="text-xs text-green-400 font-semibold mt-1">↓ {dropPct}% below all-time high</p>
              )}
            </div>
            <a
              href={productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gradient flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold"
            >
              Buy on {platform}
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </a>
          </div>

          {/* Middle — platform price comparison */}
          <div className="glass rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest">Price Comparison</h2>
            {allProducts.length > 0 ? (
              <div className="flex flex-col gap-2">
                {[...allProducts]
                  .sort((a, b) => a.price - b.price)
                  .map((p, i) => {
                    const pUrl   = p.productUrl || p.url || '#';
                    const color  = PLATFORM_COLORS[p.platform] || '#6366f1';
                    const isBest = i === 0;
                    return (
                      <a
                        key={p._id || p.id || i}
                        href={pUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all
                                    hover:scale-[1.02] hover:shadow-lg
                                    ${isBest
                                      ? 'border-green-400/40 bg-green-500/10'
                                      : 'border-white/10 bg-white/5'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-sm font-semibold text-white/80">{p.platform}</span>
                          {isBest && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">Best</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${isBest ? 'text-green-400' : 'text-white'}`}>
                            {formatCurrency(p.price)}
                          </span>
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-white/30" />
                        </div>
                      </a>
                    );
                  })}
              </div>
            ) : (
              <p className="text-white/30 text-sm">Search for this product to see cross-platform prices.</p>
            )}
          </div>

          {/* Right — stats + buy indicator */}
          <div className="flex flex-col gap-4">

            {/* Should you buy now? */}
            <div className={`glass rounded-2xl p-5 border ${isGoodDeal ? 'border-green-400/30' : 'border-yellow-400/30'}`}>
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-3">Should you buy now?</h2>
              <div className={`text-2xl font-black mb-1 ${isGoodDeal ? 'text-green-400' : 'text-yellow-400'}`}>
                {isGoodDeal ? '✅ Yes, Good Deal!' : '⏳ Wait for a Drop'}
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                {isGoodDeal
                  ? `Current price (${formatCurrency(currentPrice)}) is at or below the average (${formatCurrency(avgPrice)}).`
                  : `Current price (${formatCurrency(currentPrice)}) is above the average (${formatCurrency(avgPrice)}).`}
              </p>
            </div>

            {/* Price stats */}
            <div className="glass rounded-2xl p-5">
              <h2 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-4">Price Stats</h2>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Current',  value: currentPrice, color: 'text-white'       },
                  { label: 'Lowest',   value: minPrice,     color: 'text-green-400'   },
                  { label: 'Highest',  value: maxPrice,     color: 'text-red-400'     },
                  { label: 'Average',  value: avgPrice,     color: 'text-indigo-300'  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
                    <span className={`text-sm font-black ${color}`}>{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Chart section ── */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-base font-bold text-white/80 uppercase tracking-widest">📈 Price History</h2>
            <div className="flex gap-2">
              {RANGES.map(({ label, days }) => (
                <button
                  key={label}
                  onClick={() => setActiveRange(days)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all
                              ${activeRange === days
                                ? 'bg-indigo-500 border-indigo-400 text-white'
                                : 'border-white/15 text-white/40 hover:text-white hover:border-white/30'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-72 flex items-center justify-center text-white/30 text-sm">
              Loading price history…
            </div>
          ) : (
            <>
              {error && <p className="text-yellow-400/70 text-xs mb-3">{error}</p>}
              <div className="h-72">
                <canvas ref={canvasRef} />
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
