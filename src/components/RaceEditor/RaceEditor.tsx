"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { LocationSearch } from "./LocationSearch";
import { POIList } from "./POIList";
import type { EditorPOI } from "./POIListItem";
import type { GeocodingResult } from "@/../lib/geocoding";

// Dynamic import for map to avoid SSR issues
const EditorMap = dynamic(
  () => import("./EditorMap").then((mod) => ({ default: mod.EditorMap })),
  { ssr: false, loading: () => <div className="w-full h-full bg-gray-100 animate-pulse rounded-lg" /> }
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

export function RaceEditor({ initialRace, initialPOIs }: RaceEditorProps) {
  const router = useRouter();
  const isEditing = !!initialRace;

  // Form state
  const [name, setName] = useState(initialRace?.name ?? "");
  const [description, setDescription] = useState(initialRace?.description ?? "");
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
  const [errors, setErrors] = useState<{
    name?: string;
    pois?: string;
    poiClues?: Record<string, string>;
  }>({});

  // Mutations
  const createRace = useMutation(api.races.createRace);
  const updateRace = useMutation(api.races.updateRace);
  const bulkCreatePOIs = useMutation(api.pois.bulkCreate);

  // Add POI from search result
  const handleAddPOI = useCallback((result: GeocodingResult) => {
    const newPOI: EditorPOI = {
      id: generateId(),
      lat: result.lat,
      lng: result.lng,
      name: result.name,
      clue: "",
      validationType: "PHOTO_ONLY",
    };
    setPOIs((prev) => [...prev, newPOI]);
    // Clear POI count error if we now have enough
    setErrors((prev) => ({ ...prev, pois: undefined }));
  }, []);

  // Reorder POIs
  const handleReorder = useCallback((reordered: EditorPOI[]) => {
    setPOIs(reordered);
  }, []);

  // Update clue
  const handleClueChange = useCallback((id: string, clue: string) => {
    setPOIs((prev) =>
      prev.map((poi) => (poi.id === id ? { ...poi, clue } : poi))
    );
    // Clear this POI's clue error
    setErrors((prev) => ({
      ...prev,
      poiClues: prev.poiClues ? { ...prev.poiClues, [id]: "" } : {},
    }));
  }, []);

  // Delete POI
  const handleDelete = useCallback((id: string) => {
    setPOIs((prev) => prev.filter((poi) => poi.id !== id));
  }, []);

  // Validate form
  const validate = useCallback(() => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = "Race name is required";
    }

    if (pois.length < 2) {
      newErrors.pois = "At least 2 locations are required";
    }

    const poiClueErrors: Record<string, string> = {};
    pois.forEach((poi) => {
      if (!poi.clue.trim()) {
        poiClueErrors[poi.id] = "Clue is required";
      }
    });
    if (Object.keys(poiClueErrors).length > 0) {
      newErrors.poiClues = poiClueErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, pois]);

  // Save race
  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      if (isEditing && initialRace) {
        // Update existing race
        await updateRace({
          raceId: initialRace._id,
          name: name.trim(),
          description: description.trim(),
        });

        // Replace all POIs
        await bulkCreatePOIs({
          raceId: initialRace._id,
          pois: pois.map((poi) => ({
            lat: poi.lat,
            lng: poi.lng,
            name: poi.name,
            clue: poi.clue.trim(),
            validationType: poi.validationType,
          })),
        });
      } else {
        // Create new race
        const raceId = await createRace({
          name: name.trim(),
          description: description.trim(),
          pois: pois.map((poi) => ({
            lat: poi.lat,
            lng: poi.lng,
            name: poi.name,
            clue: poi.clue.trim(),
            validationType: poi.validationType,
          })),
        });

        router.push(`/races/${raceId}/edit`);
      }
    } catch (error) {
      console.error("Failed to save race:", error);
      setErrors({ name: "Failed to save. Please try again." });
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Race" : "Create Race"}
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? "Saving..." : "Save Race"}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Form */}
          <div className="space-y-6">
            {/* Race details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Race Details</h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="My Scavenger Hunt"
                    className={`w-full px-3 py-2 bg-white border ${
                      errors.name ? "border-red-300" : "border-gray-200"
                    } rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description of your hunt..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Location search */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Add Locations</h2>
              <LocationSearch onSelect={handleAddPOI} />
            </div>

            {/* POI list */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  Locations ({pois.length})
                </h2>
                {errors.pois && (
                  <p className="text-sm text-red-500">{errors.pois}</p>
                )}
              </div>
              <POIList
                pois={pois}
                onReorder={handleReorder}
                onClueChange={handleClueChange}
                onDelete={handleDelete}
                errors={errors.poiClues}
              />
            </div>
          </div>

          {/* Right column: Map */}
          <div className="lg:sticky lg:top-4 h-[400px] lg:h-[calc(100vh-8rem)]">
            <EditorMap pois={mapPOIs} />
          </div>
        </div>
      </main>
    </div>
  );
}
