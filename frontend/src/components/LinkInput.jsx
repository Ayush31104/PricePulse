// components/LinkInput.jsx
// Lets users paste a product URL from Amazon, Flipkart, Etsy, or eBay
// and triggers a cross-platform price comparison.

import { useState, useRef } from "react";
import {
  LinkIcon,
  XMarkIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

// ── Platform detection (mirrors backend urlParser.js logic) ──────────────────
// Done client-side so we can show instant visual feedback before the API call.
const PLATFORM_PATTERNS = [
  { name: "Amazon",   pattern: /amazon\./i,   dot: "bg-orange-400", detected: "text-orange-300 border-orange-400/40 bg-orange-500/10" },
  { name: "Flipkart", pattern: /flipkart\./i, dot: "bg-blue-400",   detected: "text-blue-300 border-blue-400/40 bg-blue-500/10"     },
  { name: "Etsy",     pattern: /etsy\./i,     dot: "bg-rose-400",   detected: "text-rose-300 border-rose-400/40 bg-rose-500/10"     },
  { name: "eBay",     pattern: /ebay\./i,     dot: "bg-yellow-400", detected: "text-yellow-300 border-yellow-400/40 bg-yellow-500/10" },
];

const detectPlatformClient = (url) => {
  if (!url) return null;
  return PLATFORM_PATTERNS.find((p) => p.pattern.test(url)) || null;
};

const isValidUrl = (url) => {
  try { new URL(url); return true; }
  catch { return false; }
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function LinkInput({ onCompare, isLoading }) {
  const [url, setUrl]           = useState("");
  const [urlError, setUrlError] = useState("");
  const inputRef                = useRef(null);

  const detectedPlatform = detectPlatformClient(url);
  const urlIsValid       = url.trim().length > 0 && isValidUrl(url.trim());
  const isSupported      = urlIsValid && detectedPlatform !== null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    setUrl(e.target.value);
    setUrlError(""); // clear error on new input
  };

  const handleClear = () => {
    setUrl("");
    setUrlError("");
    inputRef.current?.focus();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setUrlError("Please paste a product URL.");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setUrlError("That doesn't look like a valid URL. Make sure it starts with https://");
      return;
    }
    if (!detectedPlatform) {
      setUrlError("Unsupported platform. Please use an Amazon, Flipkart, Etsy, or eBay link.");
      return;
    }

    onCompare(trimmed);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative">

        {/* Link icon */}
        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none z-10" />

        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={handleChange}
          placeholder="Paste a product link (Amazon, Flipkart, Etsy, eBay)..."
          className={`glass-input w-full pl-12 pr-36 py-4 text-base rounded-2xl transition-all
                      ${urlError
                        ? "!border-red-400/60 !shadow-[0_0_0_3px_rgba(248,113,113,0.2)]"
                        : isSupported
                          ? "!border-green-400/60 !shadow-[0_0_0_3px_rgba(74,222,128,0.15)]"
                          : ""
                      }`}
        />

        {/* Clear button */}
        {url && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-32 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors z-10"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="btn-gradient absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5
                     text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
        >
          {isLoading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Comparing
            </>
          ) : (
            <>
              Compare
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </form>

      {/* ── Status row ────────────────────────────────────────────────────── */}
      <div className="mt-2.5 min-h-[24px] px-1">
        {urlError && (
          <div className="flex items-center gap-1.5 text-xs text-red-400">
            <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
            {urlError}
          </div>
        )}
        {!urlError && isSupported && (
          <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${detectedPlatform.detected}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${detectedPlatform.dot}`} />
            {detectedPlatform.name} link detected
            <CheckCircleIcon className="h-3.5 w-3.5" />
          </div>
        )}
        {!urlError && url.trim().length > 10 && urlIsValid && !isSupported && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <ExclamationCircleIcon className="h-4 w-4 shrink-0" />
            Supported platforms: Amazon · Flipkart · Etsy · eBay
          </div>
        )}
      </div>

      {/* ── Platform chips ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {PLATFORM_PATTERNS.map((p) => (
          <span
            key={p.name}
            className="text-xs glass text-white/70 px-3 py-1.5 rounded-full font-medium
                       hover:text-white hover:bg-white/15 transition-all cursor-default"
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${p.dot} mr-1.5 align-middle`} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
