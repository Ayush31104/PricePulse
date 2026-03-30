// components/FilterBar.jsx
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";

const PLATFORMS = ["Amazon", "Flipkart", "eBay", "Etsy"];

const SORT_OPTIONS = [
  { value: "default",    label: "Relevance" },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "rating",     label: "Top Rated" },
];

export default function FilterBar({ sort, setSort, activePlatforms, setActivePlatforms, totalResults }) {
  const togglePlatform = (platform) => {
    setActivePlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const allSelected = activePlatforms.length === PLATFORMS.length;
  const toggleAll = () => setActivePlatforms(allSelected ? [] : [...PLATFORMS]);

  return (
    <div className="filter-bar rounded-2xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">

        {/* Result count */}
        <div className="flex items-center gap-2 text-sm text-white/50 shrink-0">
          <AdjustmentsHorizontalIcon className="h-4 w-4" />
          <span className="font-semibold text-white/80">{totalResults} results</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          {/* Platform pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Platforms:</span>
            <button
              onClick={toggleAll}
              className={`filter-pill text-xs px-3 py-1.5 rounded-full font-semibold transition-all duration-200
                          ${allSelected ? 'btn-gradient text-white shadow-lg' : 'glass text-white/60 hover:text-white'}`}
            >
              All
            </button>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`filter-pill text-xs px-3 py-1.5 rounded-full font-semibold transition-all duration-200
                            ${activePlatforms.includes(p)
                              ? 'btn-gradient text-white shadow-lg'
                              : 'glass text-white/60 hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs font-semibold text-white/40 uppercase tracking-widest shrink-0">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="filter-select text-sm rounded-xl px-3 py-1.5 cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
