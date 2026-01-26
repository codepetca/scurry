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

interface PendingPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  fullAddress: string;
}

interface PendingRemoval {
  id: string;
  lat: number;
  lng: number;
}

interface EditorMapProps {
  pois: EditorPOI[];
  initialCenter?: { lat: number; lng: number } | null;
  searchedLocation?: SearchedLocation | null;
  onSelectNearbyPOI?: (poi: NearbyPOI) => void;
  onLongPressPOI?: (poiId: string) => void;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
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
  initialCenter,
  searchedLocation,
  onSelectNearbyPOI,
  onLongPressPOI,
  onCenterChange,
}: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapkit.Map | null>(null);
  const raceAnnotationsRef = useRef<Map<string, mapkit.Annotation>>(new Map());
  const searchedAnnotationRef = useRef<mapkit.Annotation | null>(null);
  const addOverlayRef = useRef<mapkit.Annotation | null>(null);
  const removeOverlayRef = useRef<mapkit.Annotation | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [pendingPOI, setPendingPOI] = useState<PendingPOI | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);

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
          // Explicitly enable zoom and scroll
          (map as unknown as { isZoomEnabled: boolean }).isZoomEnabled = true;
          (map as unknown as { isScrollEnabled: boolean }).isScrollEnabled = true;
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
      searchedAnnotationRef.current = null;
      addOverlayRef.current = null;
      removeOverlayRef.current = null;
      setMapReady(false);
      setPendingPOI(null);
      setPendingRemoval(null);
    };
  }, []);

  // Create a large pin element for checkpoints
  const createCheckpointPin = useCallback((order: number) => {
    const el = document.createElement("div");
    el.style.cssText = `position: relative; cursor: pointer;`;
    el.innerHTML = `
      <div style="
        width: 52px;
        height: 52px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        box-sizing: border-box;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 24px;
          font-weight: 600;
          line-height: 1;
        ">${order}</span>
      </div>
    `;
    return el;
  }, []);

  // Manage race POI annotations (green numbered markers)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const currentAnnotations = raceAnnotationsRef.current;
    const poiIds = new Set(pois.map((p) => p.id));
    const MapkitAnnotation = (window.mapkit as unknown as { Annotation: new (...args: unknown[]) => mapkit.Annotation }).Annotation;

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
        // Check if order changed by comparing data
        const existingData = (existing as unknown as { data: { order: number } }).data;
        if (existingData?.order !== poi.order) {
          // Need to recreate annotation for order update
          map.removeAnnotation(existing);
          currentAnnotations.delete(poi.id);

          const annotation = new MapkitAnnotation(
            new window.mapkit.Coordinate(poi.lat, poi.lng),
            () => createCheckpointPin(poi.order),
            {
              anchorOffset: new window.DOMPoint(0, 26),
              data: { type: "race-poi", poi, order: poi.order },
            }
          );
          map.addAnnotation(annotation);
          currentAnnotations.set(poi.id, annotation);
        } else {
          // Just update coordinate
          existing.coordinate = new window.mapkit.Coordinate(poi.lat, poi.lng);
        }
      } else {
        const annotation = new MapkitAnnotation(
          new window.mapkit.Coordinate(poi.lat, poi.lng),
          () => createCheckpointPin(poi.order),
          {
            anchorOffset: new window.DOMPoint(0, 26),
            data: { type: "race-poi", poi, order: poi.order },
          }
        );
        map.addAnnotation(annotation);
        currentAnnotations.set(poi.id, annotation);
      }
    });
  }, [pois, mapReady, createCheckpointPin]);

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

  // Store refs for click handlers (to avoid closure issues)
  const pendingPOIRef = useRef<PendingPOI | null>(null);
  const pendingRemovalRef = useRef<PendingRemoval | null>(null);
  const onSelectNearbyPOIRef = useRef(onSelectNearbyPOI);
  const onLongPressPOIRef = useRef(onLongPressPOI);

  // Keep refs updated
  useEffect(() => {
    pendingPOIRef.current = pendingPOI;
  }, [pendingPOI]);

  useEffect(() => {
    pendingRemovalRef.current = pendingRemoval;
  }, [pendingRemoval]);

  useEffect(() => {
    onSelectNearbyPOIRef.current = onSelectNearbyPOI;
  }, [onSelectNearbyPOI]);

  useEffect(() => {
    onLongPressPOIRef.current = onLongPressPOI;
  }, [onLongPressPOI]);

  // Manage the '+' pin annotation (replaces the selected POI with a green pin with '+')

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Remove existing add pin
    if (addOverlayRef.current) {
      map.removeAnnotation(addOverlayRef.current);
      addOverlayRef.current = null;
    }

    // Add '+' pin if we have a pending POI
    if (pendingPOI) {
      // Use custom annotation for larger size
      const MapkitAnnotation = (window.mapkit as unknown as { Annotation: new (...args: unknown[]) => mapkit.Annotation }).Annotation;
      const annotation = new MapkitAnnotation(
        new window.mapkit.Coordinate(pendingPOI.lat, pendingPOI.lng),
        () => {
          const el = document.createElement("div");
          el.style.cssText = `
            position: relative;
            cursor: pointer;
          `;
          // Large pin balloon with springy pulse animation
          el.innerHTML = `
            <style>
              @keyframes pin-pulse {
                0%, 100% {
                  transform: rotate(-45deg) scale(1);
                  box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                }
                50% {
                  transform: rotate(-45deg) scale(1.1);
                  box-shadow: 0 3px 20px rgba(34,197,94,0.6), 0 0 30px rgba(34,197,94,0.4);
                }
              }
            </style>
            <div style="
              width: 52px;
              height: 52px;
              background: #22c55e;
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 3px 10px rgba(0,0,0,0.3);
              box-sizing: border-box;
              animation: pin-pulse 1.8s ease-in-out infinite;
            ">
              <span style="
                transform: rotate(45deg);
                color: white;
                font-size: 36px;
                font-weight: 400;
                line-height: 1;
              ">+</span>
            </div>
          `;

          // Handle click directly on the element to avoid MapKit's zoom behavior
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const poi = pendingPOIRef.current;
            const callback = onSelectNearbyPOIRef.current;
            if (poi && callback) {
              callback({
                id: poi.id,
                lat: poi.lat,
                lng: poi.lng,
                name: poi.name,
                fullAddress: poi.fullAddress,
              });
              setPendingPOI(null);
            }
          });

          return el;
        },
        {
          anchorOffset: new window.DOMPoint(0, 26),
          data: { type: "add-pin" },
        }
      );
      map.addAnnotation(annotation);
      addOverlayRef.current = annotation;

      // Center map on the POI
      map.setCenterAnimated(
        new window.mapkit.Coordinate(pendingPOI.lat, pendingPOI.lng),
        true
      );
    }
  }, [pendingPOI, mapReady]);

  // Manage the '-' pin annotation (for removing checkpoints)
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Remove existing remove pin
    if (removeOverlayRef.current) {
      map.removeAnnotation(removeOverlayRef.current);
      removeOverlayRef.current = null;
    }

    // Add '-' pin if we have a pending removal
    if (pendingRemoval) {
      const MapkitAnnotation = (window.mapkit as unknown as { Annotation: new (...args: unknown[]) => mapkit.Annotation }).Annotation;
      const annotation = new MapkitAnnotation(
        new window.mapkit.Coordinate(pendingRemoval.lat, pendingRemoval.lng),
        () => {
          const el = document.createElement("div");
          el.style.cssText = `
            position: relative;
            cursor: pointer;
          `;
          // Large red pin balloon with '-' and springy pulse animation
          el.innerHTML = `
            <style>
              @keyframes pin-pulse-red {
                0%, 100% {
                  transform: rotate(-45deg) scale(1);
                  box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                }
                50% {
                  transform: rotate(-45deg) scale(1.1);
                  box-shadow: 0 3px 20px rgba(239,68,68,0.6), 0 0 30px rgba(239,68,68,0.4);
                }
              }
            </style>
            <div style="
              width: 52px;
              height: 52px;
              background: #ef4444;
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 3px 10px rgba(0,0,0,0.3);
              box-sizing: border-box;
              animation: pin-pulse-red 1.8s ease-in-out infinite;
            ">
              <span style="
                transform: rotate(45deg);
                color: white;
                font-size: 36px;
                font-weight: 400;
                line-height: 1;
              ">−</span>
            </div>
          `;

          // Handle click directly on the element to remove the POI
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const removal = pendingRemovalRef.current;
            const callback = onLongPressPOIRef.current;
            if (removal && callback) {
              callback(removal.id);
              setPendingRemoval(null);
            }
          });

          return el;
        },
        {
          anchorOffset: new window.DOMPoint(0, 26),
          data: { type: "remove-pin" },
        }
      );
      map.addAnnotation(annotation);
      removeOverlayRef.current = annotation;
    }
  }, [pendingRemoval, mapReady]);

  // Handle annotation selection
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    // Handle select
    const handleSelect = (event: mapkit.MapEvent) => {
      if (!event.annotation) return;

      const annotation = event.annotation as unknown as Record<string, unknown>;
      const data = annotation.data as { type: string; poi?: EditorPOI | NearbyPOI; location?: SearchedLocation } | undefined;

      if (data?.type === "add-pin" || data?.type === "remove-pin") {
        // '+' or '-' pin clicked - handled by direct click listener on DOM element
        // Just deselect to prevent any default behavior
        setTimeout(() => {
          if (mapRef.current) {
            (mapRef.current as unknown as { selectedAnnotation: null }).selectedAnnotation = null;
          }
        }, 0);
        return;
      } else if (data?.type === "race-poi" && data.poi) {
        // Race POI selected - set as pending removal (show '-' pin)
        setPendingPOI(null);
        const poi = data.poi as EditorPOI;
        setPendingRemoval({
          id: poi.id,
          lat: poi.lat,
          lng: poi.lng,
        });
        // Deselect to prevent default behavior
        setTimeout(() => {
          if (mapRef.current) {
            (mapRef.current as unknown as { selectedAnnotation: null }).selectedAnnotation = null;
          }
        }, 0);
      } else if (data?.type === "searched" && data.location) {
        // Searched location - set as pending add
        setPendingRemoval(null);
        setPendingPOI({
          id: data.location.id,
          lat: data.location.lat,
          lng: data.location.lng,
          name: data.location.name,
          fullAddress: data.location.fullAddress,
        });
      } else if (annotation.coordinate && !data?.type) {
        // Native Apple Maps POI - set as pending add and deselect native annotation
        const coord = annotation.coordinate as { latitude: number; longitude: number };
        const name = (annotation.title as string) || "Selected Location";

        // Deselect the native POI so it doesn't show alongside our '+' pin
        setTimeout(() => {
          if (mapRef.current) {
            (mapRef.current as unknown as { selectedAnnotation: null }).selectedAnnotation = null;
          }
        }, 0);

        setPendingRemoval(null);
        setPendingPOI({
          id: `native-${coord.latitude}-${coord.longitude}`,
          lat: coord.latitude,
          lng: coord.longitude,
          name: name,
          fullAddress: (annotation.subtitle as string) || name,
        });
      }
    };

    // Handle map tap (outside of annotations) - clear pending states
    // Use refs to avoid recreating this handler when state changes
    const handleSingleTap = (event: mapkit.MapEvent) => {
      if (!event.annotation) {
        if (pendingPOIRef.current) setPendingPOI(null);
        if (pendingRemovalRef.current) setPendingRemoval(null);
      }
    };

    map.addEventListener("select", handleSelect);
    map.addEventListener("single-tap", handleSingleTap);

    return () => {
      map.removeEventListener("select", handleSelect);
      map.removeEventListener("single-tap", handleSingleTap);
    };
  }, [mapReady]);

  // Clear pending POI when it gets added to the list
  useEffect(() => {
    if (pendingPOI) {
      const wasAdded = pois.some(
        (p) => Math.abs(p.lat - pendingPOI.lat) < 0.0001 && Math.abs(p.lng - pendingPOI.lng) < 0.0001
      );
      if (wasAdded) {
        setPendingPOI(null);
      }
    }
  }, [pois, pendingPOI]);

  // Clear pending removal when POI is removed from the list
  useEffect(() => {
    if (pendingRemoval) {
      const stillExists = pois.some((p) => p.id === pendingRemoval.id);
      if (!stillExists) {
        setPendingRemoval(null);
      }
    }
  }, [pois, pendingRemoval]);

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
