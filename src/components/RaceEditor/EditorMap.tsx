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

interface SearchedLocation {
  id: string;
  lat: number;
  lng: number;
  name: string;
  fullAddress: string;
}

interface EditorMapProps {
  pois: EditorPOI[];
  initialCenter?: { lat: number; lng: number } | null;
  searchedLocation?: SearchedLocation | null;
  nearbyPOIs?: NearbyPOI[];
  onSelectNearbyPOI?: (poi: NearbyPOI) => void;
  onLongPressPOI?: (poiId: string) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}

// Default center (SF Bay Area)
const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };
const DEFAULT_ZOOM = 12;
const LONG_PRESS_DURATION = 500; // ms

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
  initialCenter,
  searchedLocation,
  nearbyPOIs = [],
  onSelectNearbyPOI,
  onLongPressPOI,
  onCenterChange,
}: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapkit.Map | null>(null);
  const raceAnnotationsRef = useRef<Map<string, mapkit.Annotation>>(new Map());
  const nearbyAnnotationsRef = useRef<Map<string, mapkit.Annotation>>(new Map());
  const searchedAnnotationRef = useRef<mapkit.Annotation | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressPOIRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Clear long press timer
  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressPOIRef.current = null;
  }, []);

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
      raceAnnotationsRef.current.clear();
      nearbyAnnotationsRef.current.clear();
      searchedAnnotationRef.current = null;
      setMapReady(false);
      clearLongPress();
    };
  }, [clearLongPress]);

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
        // Update glyph text for reordering
        const anyExisting = existing as unknown as Record<string, unknown>;
        if (anyExisting.glyphText !== String(poi.order)) {
          // Need to recreate annotation for glyph update
          map.removeAnnotation(existing);
          currentAnnotations.delete(poi.id);

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

  // Manage nearby POI annotations (orange markers from "Search here")
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

    // Add annotations for new POIs
    nearbyPOIs.forEach((poi) => {
      if (!currentAnnotations.has(poi.id)) {
        const annotation = new window.mapkit.MarkerAnnotation(
          new window.mapkit.Coordinate(poi.lat, poi.lng),
          {
            color: "#f97316", // Orange
            title: poi.name,
            data: { type: "nearby", poi },
          }
        );
        map.addAnnotation(annotation);
        currentAnnotations.set(poi.id, annotation);
      }
    });
  }, [nearbyPOIs, mapReady]);

  // Manage searched location annotation (orange marker)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Remove existing searched annotation
    if (searchedAnnotationRef.current) {
      map.removeAnnotation(searchedAnnotationRef.current);
      searchedAnnotationRef.current = null;
    }

    // Add new searched annotation if provided
    if (searchedLocation) {
      const annotation = new window.mapkit.MarkerAnnotation(
        new window.mapkit.Coordinate(searchedLocation.lat, searchedLocation.lng),
        {
          color: "#f97316", // Orange
          title: searchedLocation.name,
          data: { type: "searched", location: searchedLocation },
        }
      );
      map.addAnnotation(annotation);
      searchedAnnotationRef.current = annotation;
    }
  }, [searchedLocation, mapReady]);

  // Handle annotation selection and long press
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Handle select - for native POIs, add them; for race POIs, start long press detection
    const handleSelect = (event: mapkit.MapEvent) => {
      if (!event.annotation) return;

      const annotation = event.annotation as unknown as Record<string, unknown>;
      const data = annotation.data as { type: string; poi?: EditorPOI | NearbyPOI; location?: SearchedLocation } | undefined;

      if (data?.type === "race-poi" && data.poi) {
        // Race POI selected - start long press timer for removal
        longPressPOIRef.current = (data.poi as EditorPOI).id;
        longPressTimerRef.current = setTimeout(() => {
          if (longPressPOIRef.current && onLongPressPOI) {
            onLongPressPOI(longPressPOIRef.current);
          }
          clearLongPress();
        }, LONG_PRESS_DURATION);
      } else if (data?.type === "nearby" && data.poi && onSelectNearbyPOI) {
        // Nearby POI from "Search here" - add it
        const poi = data.poi as NearbyPOI;
        onSelectNearbyPOI(poi);
      } else if (data?.type === "searched" && data.location && onSelectNearbyPOI) {
        // Searched location - add it
        onSelectNearbyPOI({
          id: data.location.id,
          lat: data.location.lat,
          lng: data.location.lng,
          name: data.location.name,
          fullAddress: data.location.fullAddress,
        });
      } else if (annotation.coordinate && onSelectNearbyPOI) {
        // Native Apple Maps POI - add it directly
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

    // Handle deselect - clear long press timer
    const handleDeselect = () => {
      clearLongPress();
    };

    map.addEventListener("select", handleSelect);
    map.addEventListener("deselect", handleDeselect);

    return () => {
      map.removeEventListener("select", handleSelect);
      map.removeEventListener("deselect", handleDeselect);
      clearLongPress();
    };
  }, [mapReady, onSelectNearbyPOI, onLongPressPOI, clearLongPress]);

  // Track map center changes
  useEffect(() => {
    if (!mapRef.current || !mapReady || !onCenterChange) return;

    const map = mapRef.current;

    const handleRegionChange = () => {
      const center = map.center;
      onCenterChange({ lat: center.latitude, lng: center.longitude });
    };

    // Fire immediately with current center
    handleRegionChange();

    map.addEventListener("region-change-end", handleRegionChange);

    return () => {
      map.removeEventListener("region-change-end", handleRegionChange);
    };
  }, [mapReady, onCenterChange]);

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
      // Calculate bounding box manually
      let minLat = pois[0].lat;
      let maxLat = pois[0].lat;
      let minLng = pois[0].lng;
      let maxLng = pois[0].lng;

      pois.forEach((p) => {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
      });

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const latSpan = (maxLat - minLat) * 1.5; // Add padding
      const lngSpan = (maxLng - minLng) * 1.5;

      const region = new window.mapkit.CoordinateRegion(
        new window.mapkit.Coordinate(centerLat, centerLng),
        new window.mapkit.CoordinateSpan(Math.max(latSpan, 0.01), Math.max(lngSpan, 0.01))
      );
      map.setRegionAnimated(region, true);
    }
  }, [pois]);

  useEffect(() => {
    if (mapReady && pois.length > 0 && !initialCenter) {
      fitBounds();
    }
  }, [mapReady, pois.length, fitBounds, initialCenter]);

  return (
    <div className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// MapKit types are declared in lib/mapkitSearch.ts
