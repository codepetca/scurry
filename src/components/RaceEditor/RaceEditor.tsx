"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Loader2, Search, X, ChevronUp, GripVertical } from "lucide-react";
import dynamic from "next/dynamic";
import type { EditorPOI } from "./POIListItem";
import { searchLocations, type GeocodingResult } from "@/../lib/mapkitSearch";
import type { NearbyPOI } from "./EditorMap";
import { useVisitorId } from "@/hooks/useVisitorId";
import { useRecentRaces } from "@/hooks/useRecentRaces";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  mode?: "collaborative" | "competitive";
  createGameOnSave?: boolean;
}

function generateId() {
  return crypto.randomUUID();
}

function generateDefaultName() {
  const now = new Date();
  return `Race ${now.toLocaleDateString()}`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (response.ok) {
      const data = await response.json();
      return data.locality || data.name || null;
    }
  } catch (error) {
    console.error("Reverse geocode error:", error);
  }
  return null;
}

// Sortable checkpoint item component
interface SortableCheckpointItemProps {
  poi: EditorPOI;
  index: number;
  onSelect: () => void;
  onRemove: () => void;
}

function SortableCheckpointItem({ poi, index, onSelect, onRemove }: SortableCheckpointItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: poi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-3 border-b border-gray-100/50 last:border-b-0 bg-white/30"
    >
      <div
        {...attributes}
        {...listeners}
        className="touch-none text-gray-400 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-3 text-left"
      >
        <span className="w-6 h-6 bg-blue-500 text-white text-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-900 truncate">
          {poi.name}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="w-8 h-8 text-gray-400 hover:text-red-500 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function RaceEditor({ initialRace, initialPOIs, mode = "collaborative", createGameOnSave = false }: RaceEditorProps) {
  const router = useRouter();
  const { visitorId } = useVisitorId();
  const { saveRace } = useRecentRaces();
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showPOIList, setShowPOIList] = useState(false);

  // Mutations
  const createRace = useMutation(api.races.createRace);
  const updateRaceWithPOIs = useMutation(api.races.updateRaceWithPOIs);
  const createGame = useMutation(api.games.create);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for reordering checkpoints
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPOIs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

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
    setShowSearchModal(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Handle map center change
  const handleMapCenterChange = useCallback((center: { lat: number; lng: number }) => {
    setCurrentMapCenter(center);
  }, []);

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
  }, [pois]);

  // Handle POI removal (long press)
  const handleRemovePOI = useCallback((poiId: string) => {
    setPOIs((prev) => prev.filter((poi) => poi.id !== poiId));
  }, []);

  // Handle Done button - go back if no checkpoints, save if checkpoints exist
  const handleDone = () => {
    if (pois.length === 0) {
      // No checkpoints - go back
      router.push(createGameOnSave ? "/create" : "/");
      return;
    }
    if (pois.length < 2) {
      // Need at least 2 checkpoints - could show a toast here
      return;
    }
    handleSave();
  };

  // Save race (and optionally create game)
  const handleSave = async () => {
    if (pois.length < 2) {
      return;
    }

    if (createGameOnSave && !visitorId) {
      console.error("No visitor ID for game creation");
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

      // Generate race name
      let raceName = initialRace?.name || generateDefaultName();

      // If creating a game, try to generate a location-based name
      if (createGameOnSave && pois.length > 0) {
        const locationName = await reverseGeocode(pois[0].lat, pois[0].lng);
        if (locationName) {
          raceName = `${locationName} Hunt`;
        }
      }

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

        if (createGameOnSave && visitorId) {
          // Save to recent races
          saveRace({
            id: raceId,
            name: raceName,
            pois: poiData,
            createdAt: Date.now(),
          });

          // Create game with the race
          const teams = mode === "collaborative" ? ["Everyone"] : ["Team 1", "Team 2"];
          const result = await createGame({
            raceId,
            hostId: visitorId,
            mode,
            teamNames: teams,
          });

          // Navigate to game lobby
          router.push(`/game/${result.code}`);
          return;
        }

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
          onSelectNearbyPOI={handleSelectPOI}
          onLongPressPOI={handleRemovePOI}
          onCenterChange={handleMapCenterChange}
        />

        {/* Top header bar */}
        <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur shadow-sm z-30">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: Checkpoint count/list toggle */}
            <button
              type="button"
              onClick={() => pois.length > 0 && setShowPOIList(!showPOIList)}
              className="flex items-center gap-2 min-w-[120px]"
            >
              <span className={`w-6 h-6 ${pois.length > 0 ? 'bg-blue-500' : 'bg-gray-300'} text-white text-sm font-bold rounded-full flex items-center justify-center`}>
                {pois.length}
              </span>
              <span className="text-sm font-medium text-gray-700">Checkpoints</span>
              {pois.length > 0 && (
                <ChevronUp className={`w-4 h-4 text-gray-500 transition-transform ${showPOIList ? "rotate-180" : ""}`} />
              )}
            </button>

            {/* Center: Title */}
            <p className="text-sm font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2">
              {createGameOnSave ? "Create Race" : "Edit Race"}
            </p>

            {/* Right: Done button */}
            <button
              type="button"
              onClick={handleDone}
              disabled={isSaving}
              className="text-green-600 disabled:text-gray-400 text-sm font-semibold flex items-center gap-1"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? "..." : "Done"}
            </button>
          </div>
        </div>

        {/* Checkpoint list dropdown */}
        {showPOIList && pois.length > 0 && (
          <>
            {/* Invisible backdrop to close dropdown */}
            <div
              className="absolute inset-0 z-10"
              onClick={() => setShowPOIList(false)}
            />
            <div className="absolute top-14 left-4 right-4 max-h-64 bg-white/70 backdrop-blur rounded-xl shadow-xl overflow-hidden z-20">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={pois.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="overflow-y-auto max-h-64">
                    {pois.map((poi, index) => (
                      <SortableCheckpointItem
                        key={poi.id}
                        poi={poi}
                        index={index}
                        onSelect={() => {
                          setMapCenter({ lat: poi.lat, lng: poi.lng });
                          setShowPOIList(false);
                        }}
                        onRemove={() => handleRemovePOI(poi.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </>
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
              {searchResults.length === 0 && searchQuery && !isSearching && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No results found
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
