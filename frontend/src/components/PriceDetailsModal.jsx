import { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { XMarkIcon, ArrowTopRightOnSquareIcon, BellIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import { formatCurrency } from '../utils/formatCurrency';
import { generatePriceHistory } from '../utils/generatePriceHistory';

const RANGES = [
  { label: '1M',  days: 30  },
  { label: '3M',  days: 90  },
  { label: '6M',  days: 180 },
  { label: 'Max', days: 0   },
];

const PLATFORM_COLORS = {
  Amazon:   '#f97316',
  Flipkart: '#3b82f6',
  eBay:     '#eab308',
  Etsy:     '#f43f5e',
  Snapdeal: '#ef4444',
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0f0c29] border border-indigo-500/30 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-white/50 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="font-black">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PriceDetailsModal({ product, allProducts = [], onClose }) {
  const overlayRef   = useRef(null);
  const [range,      setRange]      = useState(30);
  const [history,    setHistory]    = useState([]);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertSet,   setAlertSet]   = useState(false);
  const [alertMsg,   setAlertMsg]   = useState('');

  const title        = product.name || product.title || 'Product';
  const productUrl   = product.productUrl || product.url || '#';
  const currentPrice = product.price || 0;
  const platform     = product.platform || '';
  const productId    = String(product._id || product.id || '');

  // Load history using shared generator (365 days covers all range tabs)
  useEffect(() => {
    const raw = generatePriceHistory(currentPrice, 365);
    setHistory(raw.map((p) => ({
      price:      p.price,
      offerPrice: p.offerPrice,
      date:       new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      ts:         new Date(p.date).getTime(),
    })));
  }, [currentPrice]);

  // Load saved alert
  useEffect(() => {
    const saved = localStorage.getItem(`alert_${productId}`);
    if (saved) { setAlertPrice(saved); setAlertSet(true); }
  }, [productId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Filter by range ─────────────────────────────────────────────────────────
  const cutoff    = range === 0 ? 0 : Date.now() - range * 24 * 60 * 60 * 1000;
  const chartData = history.filter((p) => p.ts >= cutoff);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const allPrices = history.map((p) => p.price);
  const minPrice  = allPrices.length ? Math.min(...allPrices) : currentPrice;
  const maxPrice  = allPrices.length ? Math.max(...allPrices) : currentPrice;
  const avgPrice  = allPrices.length
    ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
    : currentPrice;

  // ── Buy recommendation ──────────────────────────────────────────────────────
  const badge = currentPrice <= minPrice
    ? { text: '🟢 Great time to buy!',       cls: 'bg-green-500/15 border-green-400/30 text-green-400'   }
    : currentPrice >= avgPrice
    ? { text: '🔴 Wait for a better deal',    cls: 'bg-red-500/15   border-red-400/30   text-red-400'     }
    : { text: '🟡 Average price — your call', cls: 'bg-yellow-500/15 border-yellow-400/30 text-yellow-300' };

  // ── Platform comparison ─────────────────────────────────────────────────────
  const sorted    = [...allProducts].sort((a, b) => a.price - b.price);
  const bestPrice = sorted[0]?.price || currentPrice;

  // ── Alert handlers ──────────────────────────────────────────────────────────
  function handleSetAlert() {
    const val = Number(alertPrice);
    if (!val || val <= 0) return;
    localStorage.setItem(`alert_${productId}`, String(val));
    setAlertSet(true);
    setAlertMsg(`✓ Alert set for ${formatCurrency(val)}`);
    setTimeout(() => setAlertMsg(''), 3000);
  }
  function handleRemoveAlert() {
    localStorage.removeItem(`alert_${productId}`);
    setAlertSet(false);
    setAlertPrice('');
  }

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
                 bg-black/70 backdrop-blur-sm px-0 sm:px-4"
    >
      <div className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh]
                      overflow-y-auto rounded-t-3xl sm:rounded-2xl
                      bg-[#0f0c29] border border-white/10
                      shadow-2xl shadow-black/60">

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3
                        px-5 pt-5 pb-4 bg-[#0f0c29] border-b border-white/08">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{platform}</p>
            <h2 className="text-sm font-bold text-white/90 line-clamp-2 leading-snug">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-xl bg-white/08 hover:bg-white/15
                       text-white/50 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">

          {/* ── Current price + badge ── */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-3xl font-black text-white tracking-tight">
                {formatCurrency(currentPrice)}
              </p>
              <p className="text-xs text-white/35 mt-0.5">Current price on {platform}</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${badge.cls}`}>
              {badge.text}
            </span>
          </div>

          {/* ── Price stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '↑ Highest', value: maxPrice,     cls: 'text-red-400'    },
              { label: '↓ Lowest',  value: minPrice,     cls: 'text-green-400'  },
              { label: '↕ Average', value: avgPrice,     cls: 'text-indigo-300' },
              { label: '● Current', value: currentPrice, cls: 'text-white'      },
            ].map(({ label, value, cls }) => (
              <div key={label} className="glass rounded-xl p-3 flex flex-col gap-1">
                <p className="text-xs text-white/35">{label}</p>
                <p className={`text-base font-black ${cls}`}>{formatCurrency(value)}</p>
              </div>
            ))}
          </div>

          {/* ── Price history chart ── */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest">
                📈 Price History
              </p>
              <div className="flex gap-1.5">
                {RANGES.map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setRange(days)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-all
                                ${range === days
                                  ? 'bg-indigo-500 border-indigo-500 text-white'
                                  : 'border-white/15 text-white/35 hover:text-white'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    width={45}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    name="Normal Price"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#priceGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="offerPrice"
                    name="With Offers"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    fill="none"
                    dot={false}
                    activeDot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-indigo-400 inline-block" />
                <span className="text-xs text-white/35">Normal price</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                <span className="text-xs text-white/35">With offers</span>
              </div>
            </div>
          </div>

          {/* ── Platform comparison ── */}
          {sorted.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">
                🛒 Price Comparison
              </p>
              <div className="flex flex-col gap-2">
                {sorted.map((p, i) => {
                  const pUrl    = p.productUrl || p.url || '#';
                  const color   = PLATFORM_COLORS[p.platform] || '#6366f1';
                  const isBest  = i === 0;
                  const diffPct = isBest ? 0 : Math.round(((p.price - bestPrice) / bestPrice) * 100);

                  return (
                    <a
                      key={p._id || p.id || i}
                      href={pUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-between px-4 py-2.5 rounded-xl
                                  border transition-all hover:scale-[1.01]
                                  ${isBest
                                    ? 'border-green-400/30 bg-green-500/08'
                                    : 'border-white/08 bg-white/04'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: color }} />
                        <span className="text-sm font-semibold text-white/80">{p.platform}</span>
                        {isBest && (
                          <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">
                            Cheapest
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-sm font-black ${isBest ? 'text-green-400' : 'text-white'}`}>
                            {formatCurrency(p.price)}
                          </span>
                          {!isBest && diffPct > 0 && (
                            <p className="text-xs text-red-400/70">+{diffPct}% higher</p>
                          )}
                        </div>
                        <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 text-white/25 flex-shrink-0" />
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Price alert ── */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BellIcon className="h-4 w-4 text-amber-400" />
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest">
                Price Alert
              </p>
            </div>

            {alertSet ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                  <CheckCircleIcon className="h-4 w-4" />
                  Alert at {formatCurrency(Number(alertPrice))}
                </div>
                <button
                  onClick={handleRemoveAlert}
                  className="text-xs text-white/30 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  placeholder={`Target price, e.g. ${Math.round(currentPrice * 0.9).toLocaleString()}`}
                  className="glass-input flex-1 px-3 py-2 rounded-xl text-sm min-w-0"
                />
                <button
                  onClick={handleSetAlert}
                  disabled={!alertPrice}
                  className="btn-gradient px-4 py-2 rounded-xl text-white text-xs font-bold
                             disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  Set Alert
                </button>
              </div>
            )}
            {alertMsg && <p className="text-xs text-amber-400 mt-2">{alertMsg}</p>}
          </div>

          {/* ── Buy button ── */}
          <a
            href={productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gradient flex items-center justify-center gap-2 py-3 rounded-xl
                       text-white text-sm font-bold"
          >
            Buy on {platform}
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>

        </div>
      </div>
    </div>
  );
}
