// pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────
// Data flow:
//   1. User logs in → JWT stored in localStorage via AuthContext
//   2. Dashboard mounts → GET /api/history?limit=10 is called
//      with the JWT in the Authorization header (set by api.js interceptor)
//   3. Backend verifies JWT, queries SearchHistory collection for this user
//   4. Response: { success, data: [...], meta: { total, ... } }
//   5. We render the list; empty / error states handled separately
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { historyService } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import {
  ClockIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

// Formats a number as Indian Rupees: ₹72,999
const formatINR = (amount) =>
  amount != null
    ? `₹${Number(amount).toLocaleString('en-IN')}`
    : null;

// Relative time label: "2 hours ago", "3 days ago", etc.
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [clearing, setClearing] = useState(false);

  // useFetch must be called unconditionally (Rules of Hooks).
  // When user is null the fetch function returns a resolved empty promise,
  // so the hook is always called but only hits the network when logged in.
  const { data: res, loading, error } = useFetch(
    () => user ? historyService.getHistory(10) : Promise.resolve({ data: null }),
    [!!user], // re-run if auth state changes
  );

  // Redirect unauthenticated users to login (after hooks are called)
  if (!user) {
    navigate('/login');
    return null;
  }

  // Backend envelope: { success: true, data: [...records], meta: {...} }
  const history = res?.data ?? [];

  const handleClear = async () => {
    if (!window.confirm('Clear all search history?')) return;
    setClearing(true);
    try {
      await historyService.clearHistory();
      window.location.reload();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Welcome banner ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 py-12 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-blue-300 text-sm font-medium mb-1">Welcome back</p>
            <h1 className="text-3xl font-extrabold text-white">
              {user.name} 👋
            </h1>
            <p className="text-blue-200 text-sm mt-1">{user.email}</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700
                         text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              New Search
            </Link>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="text-sm font-semibold text-blue-200 hover:text-white
                         border border-blue-400/40 px-4 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </section>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

        {/* Search History card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-800">Your Search History</h2>
              {history.length > 0 && (
                <span className="bg-blue-50 text-blue-600 text-xs font-semibold
                                 px-2 py-0.5 rounded-full border border-blue-100">
                  {history.length}
                </span>
              )}
            </div>
            {history.length > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-1.5 text-sm text-red-500
                           hover:text-red-600 disabled:opacity-50 transition-colors"
              >
                <TrashIcon className="h-4 w-4" />
                {clearing ? 'Clearing…' : 'Clear All'}
              </button>
            )}
          </div>

          {/* Card body */}
          <div className="px-6 py-4">

            {/* Loading */}
            {loading && (
              <div className="space-y-3 py-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="py-10 text-center">
                <p className="text-red-400 font-medium">Unable to load search history</p>
                <p className="text-gray-400 text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && history.length === 0 && (
              <div className="py-12 text-center">
                <MagnifyingGlassIcon className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No search history available</p>
                <p className="text-gray-400 text-sm mt-1">
                  Your searches will appear here after you compare prices.
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600
                             hover:text-blue-700 font-semibold"
                >
                  Start searching <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            )}

            {/* History list */}
            {!loading && !error && history.length > 0 && (
              <ul className="divide-y divide-gray-50">
                {history.map((item, idx) => (
                  <HistoryItem key={item._id} item={item} rank={idx + 1} />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Quick-action footer */}
        {!loading && history.length > 0 && (
          <div className="text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-blue-600
                         hover:text-blue-700 font-semibold"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Search more products
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HistoryItem ────────────────────────────────────────────────────────────────
// Renders a single row in the search history list.
// Shows: rank, query, cheapest price (₹), platform, result count, timestamp.
function HistoryItem({ item, rank }) {
  return (
    <li className="py-4 flex items-center gap-4">

      {/* Rank badge */}
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-400
                       text-xs font-bold flex items-center justify-center">
        {rank}
      </span>

      {/* Query + meta */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 capitalize truncate">{item.query}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {item.resultsCount > 0 && (
            <span className="text-xs text-gray-400">{item.resultsCount} results</span>
          )}
          <span className="text-xs text-gray-300">•</span>
          <span className="text-xs text-gray-400">{timeAgo(item.createdAt)}</span>
        </div>
      </div>

      {/* Price + platform */}
      <div className="text-right flex-shrink-0">
        {item.cheapestPrice ? (
          <>
            <p className="text-green-600 font-bold text-sm">
              {formatINR(item.cheapestPrice)}
            </p>
            {item.cheapestPlatform && (
              <p className="text-xs text-gray-400 mt-0.5">{item.cheapestPlatform}</p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-300">—</p>
        )}
      </div>

      {/* Re-search shortcut */}
      <Link
        to={`/?q=${encodeURIComponent(item.query)}`}
        title={`Search "${item.query}" again`}
        className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-blue-500
                   hover:bg-blue-50 transition-colors"
      >
        <MagnifyingGlassIcon className="h-4 w-4" />
      </Link>
    </li>
  );
}
