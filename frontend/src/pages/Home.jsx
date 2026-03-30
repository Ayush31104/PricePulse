import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import LinkInput from "../components/LinkInput";
import FilterBar from "../components/FilterBar";
import ProductList from "../components/ProductList";
import PriceSummaryBar from "../components/PriceSummaryBar";
import ParsedProductCard from "../components/ParsedProductCard";
import Loader from "../components/Loader";
import BackendStatus from "../components/BackendStatus";
import { fetchProducts } from "../services/searchService";
import { productService, historyService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  MagnifyingGlassIcon,
  LinkIcon,
  FaceFrownIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

const ALL_PLATFORMS = ["Amazon", "Flipkart", "eBay", "Etsy"];

// ── Search mode toggle options ────────────────────────────────────────────────
const MODES = [
  { id: "name", label: "Search by Name",  icon: MagnifyingGlassIcon },
  { id: "link", label: "Compare by Link", icon: LinkIcon             },
];

export default function Home() {
  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState("name"); // "name" | "link"
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Auto-trigger search when arriving from dashboard re-search link (/?q=...)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) handleSearch(q);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared results state ──────────────────────────────────────────────────
  const [products, setProducts]               = useState([]);
  const [meta, setMeta]                       = useState({});
  const [parsedProduct, setParsedProduct]     = useState(null); // only for link mode
  const [query, setQuery]                     = useState("");
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState(null);
  const [hasSearched, setHasSearched]         = useState(false);
  const [sort, setSort]                       = useState("default");
  const [activePlatforms, setActivePlatforms] = useState([...ALL_PLATFORMS]);

  // ── Reset shared state between searches ───────────────────────────────────
  const resetResults = () => {
    setError(null);
    setHasSearched(true);
    setIsLoading(true);
    setSort("default");
    setActivePlatforms([...ALL_PLATFORMS]);
    setParsedProduct(null);
  };

  // ── Handler: search by product name ──────────────────────────────────────
  const handleSearch = useCallback(async (searchQuery) => {
    resetResults();
    setQuery(searchQuery);

    const { data, meta: responseMeta, error: err } = await fetchProducts(searchQuery);
    setProducts(data);
    setMeta(responseMeta);
    setError(err);
    setIsLoading(false);

    // Save search to history if user is logged in
    if (user && !err && data.length > 0) {
      historyService.saveSearch({
        query: searchQuery,
        resultsCount:     data.length,
        cheapestPrice:    responseMeta?.cheapestPrice    ?? null,
        cheapestPlatform: responseMeta?.cheapestPlatform ?? null,
      }).catch(() => {}); // fire-and-forget, don't block UI
    }
  }, [user]);

  // ── Handler: compare by pasted URL ───────────────────────────────────────
  const handleCompareLink = useCallback(async (url) => {
    resetResults();
    setQuery(""); // will be filled from parsed name after response

    try {
      const res = await productService.compareLink(url);
      // Backend envelope: { success, data: { parsedProduct, products, meta } }
      const payload = res.data?.data ?? res.data;

      setQuery(payload.parsedProduct?.name ?? "");
      setParsedProduct(payload.parsedProduct ?? null);
      setProducts(payload.products ?? []);
      setMeta(payload.meta ?? {});
    } catch (err) {
      setError(err.message || "Failed to compare link. Please try again.");
      setProducts([]);
      setMeta({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Switch mode — clear results so old data doesn't bleed through ─────────
  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setProducts([]);
    setMeta({});
    setParsedProduct(null);
    setQuery("");
    setError(null);
    setHasSearched(false);
  };

  const filteredCount = activePlatforms.length
    ? products.filter((p) => activePlatforms.includes(p.platform)).length
    : products.length;

  return (
    <div className="min-h-screen page-dark">

      {/* ── Hero / Input Section ───────────────────────────────────────────── */}
      <section className="hero-bg relative overflow-hidden py-24 px-4">

        {/* Floating blurred shapes */}
        <div className="float-1 pointer-events-none absolute -top-20 -left-20 w-80 h-80 rounded-full
                        bg-purple-600/25 blur-3xl" />
        <div className="float-2 pointer-events-none absolute top-10 right-0 w-96 h-96 rounded-full
                        bg-blue-500/20 blur-3xl" />
        <div className="float-3 pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-72
                        rounded-full bg-pink-500/15 blur-3xl" />

        <div className="relative max-w-3xl mx-auto text-center">

          {/* Badge */}
          <div className="fade-in-up-1 inline-flex items-center gap-2 glass text-purple-200
                          text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide">
            ✦ Compare prices across Amazon, Flipkart, eBay &amp; Etsy
          </div>

          {/* Heading */}
          <h1 className="fade-in-up-2 text-5xl sm:text-6xl font-black text-white mb-5
                         leading-[1.1] tracking-tight">
            Find the{" "}
            <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-pink-400
                             bg-clip-text text-transparent">
              Best Price
            </span>
            <br />in Seconds
          </h1>

          {/* Subtitle */}
          <p className="fade-in-up-3 text-white/60 text-base sm:text-lg mb-10 max-w-xl mx-auto
                        leading-relaxed tracking-wide">
            Search by product name or paste a link we'll compare prices everywhere.
          </p>

          {/* Mode toggle */}
          <div className="fade-in-up-3 inline-flex glass rounded-2xl p-1 mb-8 gap-1">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleModeSwitch(id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                            transition-all duration-200
                            ${mode === id
                              ? "bg-white text-gray-900 shadow-lg"
                              : "text-white/60 hover:text-white hover:bg-white/10"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Active input */}
          <div className="fade-in-up-4">
            {mode === "name" ? (
              <SearchBar onSearch={handleSearch} isLoading={isLoading} />
            ) : (
              <LinkInput onCompare={handleCompareLink} isLoading={isLoading} />
            )}
          </div>
        </div>
      </section>

      {/* ── Results Section ────────────────────────────────────────────────── */}
      <section className="results-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Backend status — only before first search */}
        {!hasSearched && <BackendStatus />}

        {/* Loading skeleton */}
        {isLoading && <Loader count={8} />}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <ExclamationTriangleIcon className="h-14 w-14 text-red-400 mb-4" />
            <h3 className="text-xl font-bold text-white/80 mb-2">Something went wrong</h3>
            <p className="text-white/50 max-w-sm mb-4">{error}</p>
            <p className="text-xs text-white/30 glass rounded-lg px-4 py-2">
              Make sure the backend is running:{" "}
              <code className="font-mono">npm run dev:server</code>
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && hasSearched && products.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <FaceFrownIcon className="h-14 w-14 text-white/20 mb-4" />
            <h3 className="text-xl font-bold text-white/80 mb-2">No products found</h3>
            <p className="text-white/40 max-w-sm">
              {mode === "link"
                ? "Couldn't find comparison results for this link. Try searching by product name instead."
                : `We couldn't find anything for "${query}". Try "iPhone", "MacBook", or "Nike".`}
            </p>
          </div>
        )}

        {/* Initial state */}
        {!isLoading && !hasSearched && <InitialState mode={mode} />}

        {/* Results */}
        {!isLoading && !error && products.length > 0 && (
          <div className="space-y-6">

            {/* Parsed product card — only in link mode */}
            {mode === "link" && parsedProduct && (
              <ParsedProductCard parsedProduct={parsedProduct} />
            )}

            {/* Price summary strip */}
            <PriceSummaryBar products={products} query={query} meta={meta} />

            {/* Cache indicator */}
            {meta.servedFromCache && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50
                              border border-amber-200 rounded-xl px-4 py-2 w-fit">
                <span>⚡</span>
                <span>Results served from cache — prices may be up to 10 minutes old</span>
              </div>
            )}

            {/* Filter + sort bar */}
            <FilterBar
              sort={sort}
              setSort={setSort}
              activePlatforms={activePlatforms}
              setActivePlatforms={setActivePlatforms}
              totalResults={filteredCount}
            />

            {filteredCount === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg font-medium text-white/50">No results for selected platforms.</p>
                <p className="text-sm mt-1 text-white/30">Try enabling more platforms above.</p>
              </div>
            ) : (
              <ProductList
                products={products}
                sort={sort}
                activePlatforms={activePlatforms}
              />
            )}
          </div>
        )}
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      {!hasSearched && <HowItWorks />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InitialState({ mode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="bg-blue-50 rounded-full p-6 mb-5">
        {mode === "link"
          ? <LinkIcon className="h-12 w-12 text-violet-400" />
          : <MagnifyingGlassIcon className="h-12 w-12 text-blue-400" />
        }
      </div>
      <h3 className="text-xl font-bold text-white mb-2">
        {mode === "link" ? "Paste a product link" : "Start comparing prices"}
      </h3>
      <p className="text-white/50 max-w-sm text-sm">
        {mode === "link"
          ? "Copy any product URL from Amazon, Flipkart, Etsy, or eBay and paste it above."
          : "Type a product name above or click one of the quick suggestions."}
      </p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: "🔍", title: "Search or Paste",    desc: "Type a product name or paste a link from any major platform." },
    { icon: "📊", title: "Compare Prices",      desc: "See prices from Amazon, Flipkart, eBay & Etsy side by side." },
    { icon: "🏆", title: "Find the Best Deal",  desc: "The cheapest option is highlighted automatically." },
    { icon: "🛒", title: "Go Buy It",           desc: "Click 'View Deal' to go directly to the product page." },
  ];

  return (
    <section id="how-it-works" className="border-t border-white/5 py-16 px-4"
             style={{background:'rgba(255,255,255,0.02)'}}>
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-black text-center text-white/90 mb-10 tracking-tight">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={i} className="text-center p-6 rounded-2xl glass border-white/10">
              <div className="text-4xl mb-3">{s.icon}</div>
              <h3 className="font-bold text-white/90 mb-1">{s.title}</h3>
              <p className="text-sm text-white/50">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
