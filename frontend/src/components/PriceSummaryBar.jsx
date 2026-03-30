// ============================================================
// components/PriceSummaryBar.jsx — Price statistics strip
// ============================================================
// Displays a coloured banner above the product grid showing:
//   - Lowest price found (and which platform has it)
//   - Highest price found
//   - Average price across all results
//   - Maximum potential saving (highest − lowest)
//
// Props:
//   products — array of product objects currently displayed
//   query    — the search term (shown in the banner text)
//   meta     — optional backend meta object with pre-calculated stats
//              (more accurate than client-side calculation because it
//               uses all results before pagination/filtering)

import { formatCurrency } from '../utils/formatCurrency';

const STAT_ICONS = {
  lowest:  '🏷️',
  highest: '📈',
  average: '📊',
  savings: '💰',
};

export default function PriceSummaryBar({ products, query, meta = {} }) {
  if (!products.length) return null;

  const prices = products.map((p) => p.price);
  const min    = meta.priceRange?.min ?? Math.min(...prices);
  const max    = meta.priceRange?.max ?? Math.max(...prices);
  const avg    = meta.priceRange?.avg ?? prices.reduce((a, b) => a + b, 0) / prices.length;
  const saving = max - min;
  const cheapestPlatform = meta.cheapestPlatform ?? products.find((p) => p.price === min)?.platform;

  return (
    <div className="stats-bar rounded-2xl p-5 text-white shadow-xl">
      <p className="text-sm font-medium text-white/60 mb-4 tracking-wide">
        Price comparison for{' '}
        <span className="font-bold text-white">"{query}"</span>{' '}
        — {meta.total ?? products.length} listings found
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={STAT_ICONS.lowest}  label="Lowest Price"  value={formatCurrency(min)} sub={cheapestPlatform} highlight />
        <Stat icon={STAT_ICONS.highest} label="Highest Price" value={formatCurrency(max)} />
        <Stat icon={STAT_ICONS.average} label="Average Price" value={formatCurrency(avg)} />
        <Stat icon={STAT_ICONS.savings} label="Max Savings"   value={formatCurrency(saving)} sub="vs most expensive" />
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, highlight }) {
  return (
    <div className={`stat-card rounded-xl p-3.5 flex flex-col gap-1 cursor-default
                     ${highlight ? 'ring-1 ring-green-400/40 bg-green-500/10' : ''}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-base">{icon}</span>
        <p className="text-xs text-white/50 font-medium tracking-wide">{label}</p>
      </div>
      <p className={`text-xl font-black tracking-tight ${highlight ? 'text-green-300' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}
