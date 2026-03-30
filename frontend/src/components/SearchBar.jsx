// components/SearchBar.jsx
import { useState, useEffect, useRef } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

// Popular search suggestions shown as quick-pick chips
const SUGGESTIONS = ["iPhone 13", "MacBook Pro", "Sony Headphones", "Samsung Galaxy S23", "Nike Air Max", "iPad"];

export default function SearchBar({ onSearch, isLoading }) {
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef(null);

  // Debounce: wait 500ms after the user stops typing before firing search
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 500);
    return () => clearTimeout(timer);
  }, [value]);

  // Trigger search whenever debounced value changes (and is non-empty)
  useEffect(() => {
    if (debounced.trim()) onSearch(debounced.trim());
  }, [debounced]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  const handleClear = () => {
    setValue("");
    inputRef.current?.focus();
  };

  const handleSuggestion = (s) => {
    setValue(s);
    onSearch(s);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search for a product (e.g. iPhone 13)..."
          className="glass-input w-full pl-12 pr-32 py-4 text-base rounded-2xl"
        />
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-28 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
        {/* Search button */}
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="btn-gradient absolute right-2 top-1/2 -translate-y-1/2 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          {isLoading ? "..." : "Search"}
        </button>
      </form>

      {/* Quick suggestion chips */}
      <div className="flex flex-wrap gap-2 mt-4 justify-center">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleSuggestion(s)}
            className="text-xs glass text-white/70 px-3 py-1.5 rounded-full
                       hover:text-white hover:bg-white/15 transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
