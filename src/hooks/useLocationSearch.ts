"use client";

import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";
import { searchLocations, type GeocodingResult } from "@/../lib/mapkitSearch";

interface UseLocationSearchOptions {
  debounceMs?: number;
  limit?: number;
  proximity?: { lat: number; lng: number };
}

interface UseLocationSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: GeocodingResult[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

export function useLocationSearch(
  options: UseLocationSearchOptions = {}
): UseLocationSearchResult {
  const { debounceMs = 300, limit = 5, proximity } = options;

  // Extract lat/lng to use as stable dependencies
  const proximityLat = proximity?.lat;
  const proximityLng = proximity?.lng;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, debounceMs);

  useEffect(() => {
    const search = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      const proximityOption =
        proximityLat !== undefined && proximityLng !== undefined
          ? { lat: proximityLat, lng: proximityLng }
          : undefined;

      try {
        const searchResults = await searchLocations(debouncedQuery, {
          limit,
          proximity: proximityOption,
        });
        setResults(searchResults);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery, limit, proximityLat, proximityLng]);

  const clearResults = () => {
    setResults([]);
    setQuery("");
  };

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearResults,
  };
}
