"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface EditorPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  order: number;
}

export interface NearbyPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  fullAddress: string;
  category?: string;
}

export interface SelectedPOI {
  lat: number;
  lng: number;
  name: string;
  fullAddress: string;
}

interface EditorMapProps {
  pois: EditorPOI[];
  nearbyPOIs?: NearbyPOI[];
  selectedPOI?: SelectedPOI | null;
  initialCenter?: { lat: number; lng: number } | null;
  isLoading?: boolean;
  onPOIClick?: (poi: EditorPOI) => void;
  onSelectNearbyPOI?: (poi: NearbyPOI) => void;
  onAddPOI?: () => void;
  onClearSelection?: () => void;
}

// Default center (SF Bay Area)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_ZOOM = 12;

// Track MapKit initialization
let mapkitLoadPromise: Promise<void> | null = null;

async function loadMapKit(): Promise<void> {
  if (mapkitLoadPromise) return mapkitLoadPromise;

  mapkitLoadPromise = new Promise(async (resolve, reject) => {
    try {
      if (!document.querySelector('script[src*="apple-mapkit"]')) {
        const script = document.createElement("script");
        script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
        script.crossOrigin = "anonymous";

        await new Promise<void>((res, rej) => {
          script.onload = () => res();
          script.onerror = () => rej(new Error("Failed to load MapKit JS"));
          document.head.appendChild(script);
        });
      }

      while (!window.mapkit) {
        await new Promise((r) => setTimeout(r, 50));
      }

      const tokenResponse = await fetch("/api/mapkit-token");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get MapKit token");
      }
      const { token } = await tokenResponse.json();

      window.mapkit.init({
        authorizationCallback: (done: (token: string) => void) => {
          done(token);
        },
      });

      resolve();
    } catch (error) {
      mapkitLoadPromise = null;
      reject(error);
    }
  });

  return mapkitLoadPromise;
}

export function EditorMap({
  pois,
  nearbyPOIs = [],
  selectedPOI,
  initialCenter,
  isLoading,
  onPOIClick,
  onSelectNearbyPOI,
  onAddPOI,
  onClearSelection,
}: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapkit.Map | null>(null);
  const raceAnnotationsRef = useRef<Map<string, mapkit.Annotation>>(new Map());
  const nearbyAnnotationsRef = useRef<Map<string, mapkit.Annotation>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // Initialize MapKit and create map
  useEffect(() => {
    if (!containerRef.current) return;

    let map: mapkit.Map | null = null;

    const initMap = async () => {
      try {
        await loadMapKit();

        if (!containerRef.current || mapRef.current) return;

        map = new window.mapkit.Map(containerRef.current, {
          center: new window.mapkit.Coordinate(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          showsCompass: window.mapkit.FeatureVisibility.Hidden,
          showsZoomControl: false,
          showsMapTypeControl: false,
          showsPointsOfInterest: true,
        });

        // Enable native POI selection
        if (window.mapkit.MapFeatureType) {
          map.selectableMapFeatures = [window.mapkit.MapFeatureType.PointOfInterest];
        }

        if (map) {
          map._impl.zoomLevel = DEFAULT_ZOOM;
          mapRef.current = map;
          setMapReady(true);
        }
      } catch (error) {
        console.error("Failed to initialize MapKit:", error);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      // Clear annotation refs when map is destroyed
      raceAnnotationsRef.current.clear();
      nearbyAnnotationsRef.current.clear();
      setMapReady(false);
    };
  }, []);

  // Manage race POI annotations (green numbered markers)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const currentAnnotations = raceAnnotationsRef.current;
    const poiIds = new Set(pois.map((p) => p.id));

    // Remove annotations for POIs that no longer exist
    currentAnnotations.forEach((annotation, id) => {
      if (!poiIds.has(id)) {
        map.removeAnnotation(annotation);
        currentAnnotations.delete(id);
      }
    });

    // Add/update annotations for current POIs
    pois.forEach((poi) => {
      const existing = currentAnnotations.get(poi.id);

      if (existing) {
        existing.coordinate = new window.mapkit.Coordinate(poi.lat, poi.lng);
      } else {
        const annotation = new window.mapkit.MarkerAnnotation(
          new window.mapkit.Coordinate(poi.lat, poi.lng),
          {
            color: "#22c55e",
            glyphText: String(poi.order),
            title: poi.name,
            data: { type: "race-poi", poi },
          }
        );

        map.addAnnotation(annotation);
        currentAnnotations.set(poi.id, annotation);
      }
    });
  }, [pois, mapReady]);

  // Manage nearby POI annotations (orange markers)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const currentAnnotations = nearbyAnnotationsRef.current;
    const poiIds = new Set(nearbyPOIs.map((p) => p.id));

    // Remove annotations for POIs that no longer exist
    currentAnnotations.forEach((annotation, id) => {
      if (!poiIds.has(id)) {
        map.removeAnnotation(annotation);
        currentAnnotations.delete(id);
      }
    });

    // Add/update annotations for nearby POIs
    nearbyPOIs.forEach((poi) => {
      const existing = currentAnnotations.get(poi.id);
      const isSelected = selectedPOI?.lat === poi.lat && selectedPOI?.lng === poi.lng;

      if (existing) {
        existing.coordinate = new window.mapkit.Coordinate(poi.lat, poi.lng);
        existing.color = isSelected ? "#22c55e" : "#f97316";
      } else {
        const annotation = new window.mapkit.MarkerAnnotation(
          new window.mapkit.Coordinate(poi.lat, poi.lng),
          {
            color: isSelected ? "#22c55e" : "#f97316",
            title: poi.name,
            data: { type: "nearby-poi", poi },
          }
        );

        map.addAnnotation(annotation);
        currentAnnotations.set(poi.id, annotation);
      }
    });
  }, [nearbyPOIs, selectedPOI, mapReady]);

  // Handle annotation selection
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    const handleSelect = (event: mapkit.MapEvent) => {
      if (!event.annotation) return;

      const annotation = event.annotation as unknown as Record<string, unknown>;
      const data = annotation.data as { type: string; poi: EditorPOI | NearbyPOI } | undefined;

      if (data?.type === "race-poi" && onPOIClick) {
        onPOIClick(data.poi as EditorPOI);
      } else if (data?.type === "nearby-poi" && onSelectNearbyPOI) {
        onSelectNearbyPOI(data.poi as NearbyPOI);
      } else if (annotation.coordinate && onSelectNearbyPOI) {
        // Native Apple Maps POI - no custom data but has coordinate
        const coord = annotation.coordinate as { latitude: number; longitude: number };
        const name = (annotation.title as string) || "Selected Location";
        onSelectNearbyPOI({
          id: `native-${coord.latitude}-${coord.longitude}`,
          lat: coord.latitude,
          lng: coord.longitude,
          name: name,
          fullAddress: (annotation.subtitle as string) || name,
        });
      }
    };

    map.addEventListener("select", handleSelect);

    return () => {
      map.removeEventListener("select", handleSelect);
    };
  }, [mapReady, onPOIClick, onSelectNearbyPOI]);

  // Fly to initial center when it changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || !initialCenter) return;

    const map = mapRef.current;
    map.setCenterAnimated(
      new window.mapkit.Coordinate(initialCenter.lat, initialCenter.lng),
      true
    );
    map._impl.zoomLevel = 16;
  }, [initialCenter, mapReady]);

  // Fit bounds when race POIs change (only if no initialCenter)
  const fitBounds = useCallback(() => {
    if (!mapRef.current || pois.length === 0) return;

    const map = mapRef.current;

    if (pois.length === 1) {
      map.setCenterAnimated(
        new window.mapkit.Coordinate(pois[0].lat, pois[0].lng),
        true
      );
      map._impl.zoomLevel = 15;
    } else {
      const coordinates = pois.map(
        (p) => new window.mapkit.Coordinate(p.lat, p.lng)
      );
      const boundingRegion = window.mapkit.BoundingRegion.fromCoordinates(coordinates);
      map.setRegionAnimated(boundingRegion.toCoordinateRegion(), true);
    }
  }, [pois]);

  useEffect(() => {
    if (mapReady && pois.length > 0 && !initialCenter) {
      fitBounds();
    }
  }, [mapReady, pois.length, fitBounds, initialCenter]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 left-4 z-10 px-3 py-2 bg-white rounded-full shadow-lg border border-gray-200 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-gray-600">Loading places...</span>
        </div>
      )}

      {/* Hint text when no POI selected and not loading */}
      {!selectedPOI && !isLoading && mapReady && nearbyPOIs.length === 0 && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur rounded-full shadow-lg border border-gray-200 px-4 py-2 text-center">
            <p className="text-sm text-gray-600">Search for a location to find places nearby</p>
          </div>
        </div>
      )}

      {/* Hint when POIs are shown but none selected */}
      {!selectedPOI && !isLoading && nearbyPOIs.length > 0 && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur rounded-full shadow-lg border border-gray-200 px-4 py-2 text-center">
            <p className="text-sm text-gray-600">Tap an orange pin to add it</p>
          </div>
        </div>
      )}

      {/* Selected POI - compact bottom bar */}
      {selectedPOI && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-full shadow-xl border border-gray-200 px-4 py-2 z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={onClearSelection}
            className="flex-shrink-0 w-8 h-8 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
            aria-label="Cancel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{selectedPOI.name}</p>
          </div>
          <button
            type="button"
            onClick={onAddPOI}
            className="flex-shrink-0 w-10 h-10 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors"
            aria-label="Add to race"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// MapKit types are declared in lib/mapkitSearch.ts
