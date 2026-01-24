"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Loader2, Search, X, ChevronUp } from "lucide-react";
import dynamic from "next/dynamic";
import type { EditorPOI } from "./POIListItem";
import { searchLocations, searchNearbyPOIs, type GeocodingResult } from "@/../lib/mapkitSearch";
import type { NearbyPOI } from "./EditorMap";

// Dynamic import for map to avoid SSR issues
const EditorMap = dynamic(
  () => import("./EditorMap").then((mod) => ({ default: mod.EditorMap })),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" /> }
);

interface InitialRace {
  _id: Id<"races">;
  name: string;
  description: string;
}

interface InitialPOI {
  _id: Id<"pois">;
  lat: number;
  lng: number;
  name?: string;
  clue: string;
  order: number;
  validationType: "PHOTO_ONLY" | "GPS_RADIUS" | "QR_CODE" | "MANUAL";
}

interface RaceEditorProps {
  initialRace?: InitialRace;
  initialPOIs?: InitialPOI[];
}

function generateId() {
  return crypto.randomUUID();
}

function generateDefaultName() {
  const now = new Date();
  return `Race ${now.toLocaleDateString()}`;
}

export function RaceEditor({ initialRace, initialPOIs }: RaceEditorProps) {
  const router = useRouter();
  const isEditing = !!initialRace;

  // Form state
  const [pois, setPOIs] = useState<EditorPOI[]>(() => {
    if (initialPOIs) {
      return initialPOIs.map((p) => ({
        id: p._id,
        lat: p.lat,
        lng: p.lng,
        name: p.name ?? `Location ${p.order}`,
        clue: p.clue,
        validationType: p.validationType,
      }));
    }
    return [];
  });

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [currentMapCenter, setCurrentMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<GeocodingResult | null>(null);
  const [nearbyPOIs, setNearbyPOIs] = useState<GeocodingResult[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPOIList, setShowPOIList] = useState(false);

  // Mutations
  const createRace = useMutation(api.races.createRace);
  const updateRaceWithPOIs = useMutation(api.races.updateRaceWithPOIs);

  // Debounced search using Server API (same engine as Apple Maps app)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Use Server API for search - more similar to Apple Maps app
        // Use current map center for proximity if available
        const searchCenter = currentMapCenter || { lat: 37.7749, lng: -122.4194 };
        const response = await fetch(
          `/api/apple-maps-search?q=${encodeURIComponent(searchQuery)}&lat=${searchCenter.lat}&lng=${searchCenter.lng}`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults((data.results || []).slice(0, 5));
        } else {
          // Fallback to MapKit JS search
          const results = await searchLocations(searchQuery, { limit: 5 });
          setSearchResults(results);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentMapCenter]);

  // Handle search result selection
  const handleSelectSearchResult = useCallback((result: GeocodingResult) => {
    setMapCenter({ lat: result.lat, lng: result.lng });
    setSearchedLocation(result); // Show as tappable marker
    setNearbyPOIs([]); // Clear nearby POIs when navigating
    setShowSearchModal(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Handle map center change
  const handleMapCenterChange = useCallback((center: { lat: number; lng: number }) => {
    setCurrentMapCenter(center);
  }, []);

  // Search for POIs in current map area (with optional query filter)
  const handleSearchHere = useCallback(async (query?: string) => {
    if (!currentMapCenter) return;

    setIsLoadingNearby(true);
    setSearchedLocation(null); // Clear single searched location
    setShowSearchModal(false);
    setSearchQuery("");
    setSearchResults([]);

    try {
      if (query) {
        // Search with specific query term
        const response = await fetch(
          `/api/apple-maps-search?q=${encodeURIComponent(query)}&lat=${currentMapCenter.lat}&lng=${currentMapCenter.lng}`
        );
        if (response.ok) {
          const data = await response.json();
          setNearbyPOIs(data.results || []);
        } else {
          setNearbyPOIs([]);
        }
      } else {
        // Generic nearby search
        const results = await searchNearbyPOIs(currentMapCenter, { limit: 20 });
        setNearbyPOIs(results);
      }
    } catch (error) {
      console.error("Failed to search nearby POIs:", error);
      setNearbyPOIs([]);
    } finally {
      setIsLoadingNearby(false);
    }
  }, [currentMapCenter]);

  // Handle POI selection from map (tap to add)
  const handleSelectPOI = useCallback((poi: NearbyPOI) => {
    // Check if POI already exists at this location
    const exists = pois.some(
      (p) => Math.abs(p.lat - poi.lat) < 0.0001 && Math.abs(p.lng - poi.lng) < 0.0001
    );

    if (exists) return;

    const newPOI: EditorPOI = {
      id: generateId(),
      lat: poi.lat,
      lng: poi.lng,
      name: poi.name,
      clue: "",
      validationType: "PHOTO_ONLY",
    };
    setPOIs((prev) => [...prev, newPOI]);
    setSearchedLocation(null); // Clear searched location marker after adding
    // Remove the added POI from nearbyPOIs
    setNearbyPOIs((prev) => prev.filter(
      (p) => Math.abs(p.lat - poi.lat) > 0.0001 || Math.abs(p.lng - poi.lng) > 0.0001
    ));
  }, [pois]);

  // Handle POI removal (long press)
  const handleRemovePOI = useCallback((poiId: string) => {
    setPOIs((prev) => prev.filter((poi) => poi.id !== poiId));
  }, []);

  // Save race
  const handleSave = async () => {
    if (pois.length < 2) {
      // Show some feedback - need at least 2 POIs
      return;
    }

    setIsSaving(true);
    try {
      const poiData = pois.map((poi) => ({
        lat: poi.lat,
        lng: poi.lng,
        name: poi.name,
        clue: poi.clue || "Find this location!",
        validationType: poi.validationType,
      }));

      const raceName = initialRace?.name || generateDefaultName();

      if (isEditing && initialRace) {
        await updateRaceWithPOIs({
          raceId: initialRace._id,
          name: raceName,
          description: "",
          pois: poiData,
        });
      } else {
        const raceId = await createRace({
          name: raceName,
          description: "",
          pois: poiData,
        });
        router.push(`/races/${raceId}/edit`);
      }
    } catch (error) {
      console.error("Failed to save race:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Map POIs with order
  const mapPOIs = useMemo(
    () =>
      pois.map((poi, index) => ({
        id: poi.id,
        lat: poi.lat,
        lng: poi.lng,
        name: poi.name,
        order: index + 1,
      })),
    [pois]
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Full-screen map */}
      <div className="flex-1 relative">
        <EditorMap
          pois={mapPOIs}
          initialCenter={mapCenter}
          searchedLocation={searchedLocation}
          nearbyPOIs={nearbyPOIs}
          onSelectNearbyPOI={handleSelectPOI}
          onLongPressPOI={handleRemovePOI}
          onCenterChange={handleMapCenterChange}
        />

        {/* Search here button */}
        <button
          type="button"
          onClick={() => handleSearchHere()}
          disabled={isLoadingNearby || !currentMapCenter}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/90 backdrop-blur rounded-full shadow-lg text-sm font-medium text-gray-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isLoadingNearby ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Search here
            </>
          )}
        </button>

        {/* Top bar - floating */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="pointer-events-auto w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || pois.length < 2}
            className="pointer-events-auto px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-full shadow-lg flex items-center gap-2 transition-colors"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* POI count badge */}
        {pois.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPOIList(!showPOIList)}
            className="absolute top-16 left-4 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full shadow-lg flex items-center gap-2"
          >
            <span className="w-6 h-6 bg-green-500 text-white text-sm font-bold rounded-full flex items-center justify-center">
              {pois.length}
            </span>
            <span className="text-sm font-medium text-gray-700">locations</span>
            <ChevronUp className={`w-4 h-4 text-gray-500 transition-transform ${showPOIList ? "rotate-180" : ""}`} />
          </button>
        )}

        {/* POI list dropdown */}
        {showPOIList && pois.length > 0 && (
          <div className="absolute top-28 left-4 right-4 max-h-64 bg-white/95 backdrop-blur rounded-xl shadow-xl overflow-hidden">
            <div className="overflow-y-auto max-h-64">
              {pois.map((poi, index) => (
                <div
                  key={poi.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0"
                >
                  <span className="w-6 h-6 bg-green-500 text-white text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {poi.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePOI(poi.id)}
                    className="w-8 h-8 text-gray-400 hover:text-red-500 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Bottom search bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 pb-safe">
        <button
          type="button"
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-full text-left"
        >
          <Search className="w-5 h-5 text-gray-400" />
          <span className="text-gray-500">Search for a place...</span>
        </button>
      </div>

      {/* Search bottom sheet */}
      {showSearchModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => {
              setShowSearchModal(false);
              setSearchQuery("");
              setSearchResults([]);
            }}
          />

          {/* Bottom sheet */}
          <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-xl max-h-[40vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Search input */}
            <div className="flex items-center gap-3 px-4 pb-3">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a place..."
                autoFocus
                className="flex-1 text-base outline-none bg-transparent"
              />
              {isSearching && <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="w-6 h-6 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Search results */}
            <div className="flex-1 overflow-y-auto border-t border-gray-100">
              {/* Search in this area option */}
              {searchQuery.trim() && currentMapCenter && (
                <button
                  type="button"
                  onClick={() => handleSearchHere(searchQuery.trim())}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-left active:bg-blue-50 bg-blue-50/50"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Search className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-600 text-sm">Search "{searchQuery.trim()}" in this area</p>
                    <p className="text-xs text-gray-500">Find all matches on the map</p>
                  </div>
                </button>
              )}

              {searchResults.length === 0 && searchQuery && !isSearching && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No direct matches found
                </div>
              )}
              {searchResults.length === 0 && !searchQuery && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  Type to search for a location
                </div>
              )}
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelectSearchResult(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 text-left active:bg-gray-50"
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{result.name}</p>
                    <p className="text-xs text-gray-500 truncate">{result.fullAddress}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
