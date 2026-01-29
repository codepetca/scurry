"use client";

import { useRef, useEffect } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { useLocationSearch } from "@/hooks/useLocationSearch";
import type { GeocodingResult } from "@/../lib/mapkitSearch";

interface LocationSearchProps {
  onSelect: (result: GeocodingResult) => void;
  placeholder?: string;
}

export function LocationSearch({
  onSelect,
  placeholder = "Search for a location...",
}: LocationSearchProps) {
  const { query, setQuery, results, isLoading, clearResults } =
    useLocationSearch({ debounceMs: 300 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        clearResults();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [clearResults]);

  const handleSelect = (result: GeocodingResult) => {
    onSelect(result);
    setQuery("");
    clearResults();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      handleSelect(results[0]);
    }
  };

  const showDropdown = results.length > 0 || (isLoading && query.length > 0);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
        >
          {isLoading && results.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-sm">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-sm">
              No results found
            </div>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-start gap-3 border-b border-gray-100 last:border-b-0"
              >
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {result.name}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {result.fullAddress}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
