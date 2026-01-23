"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { MapContext } from "../MapLibre/MapContext";
import "maplibre-gl/dist/maplibre-gl.css";

interface EditorPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  order: number;
}

interface EditorMapProps {
  pois: EditorPOI[];
  onPOIClick?: (poi: EditorPOI) => void;
  children?: React.ReactNode;
}

// Register PMTiles protocol once
let protocolRegistered = false;

// Default bounds (SF Bay Area)
const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12;

export function EditorMap({ pois, onPOIClick, children }: EditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Register PMTiles protocol
    if (!protocolRegistered) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      protocolRegistered = true;
    }

    // Protomaps API key from environment
    const apiKey = process.env.NEXT_PUBLIC_PROTOMAPS_API_KEY;

    // Initialize map with Protomaps vector tiles + Level 2 simplified style
    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: false,
      style: {
        version: 8,
        glyphs: "https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf",
        sources: {
          protomaps: {
            type: "vector",
            url: `https://api.protomaps.com/tiles/v4.json?key=${apiKey}`,
            attribution:
              '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org">OSM</a>',
          },
        },
        layers: [
          // Background - soft warm gray
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#f5f3f0",
            },
          },
          // Water - soft blue, subtle opacity
          {
            id: "water",
            type: "fill",
            source: "protomaps",
            "source-layer": "water",
            paint: {
              "fill-color": "#c4dff6",
              "fill-opacity": 0.6,
            },
          },
          // Parks and green areas - soft green
          {
            id: "landuse-park",
            type: "fill",
            source: "protomaps",
            "source-layer": "landuse",
            filter: [
              "in",
              "pmap:kind",
              "park",
              "nature_reserve",
              "garden",
              "grass",
              "cemetery",
            ],
            paint: {
              "fill-color": "#d5e8d4",
            },
          },
          // Highways (motorway, trunk)
          {
            id: "roads-highway",
            type: "line",
            source: "protomaps",
            "source-layer": "roads",
            filter: [
              "any",
              ["==", ["get", "kind_detail"], "motorway"],
              ["==", ["get", "kind_detail"], "trunk"],
            ],
            paint: {
              "line-color": "#ffffff",
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 12],
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          },
          // Main city streets (primary, secondary)
          {
            id: "roads-main",
            type: "line",
            source: "protomaps",
            "source-layer": "roads",
            filter: [
              "any",
              ["==", ["get", "kind_detail"], "primary"],
              ["==", ["get", "kind_detail"], "secondary"],
            ],
            paint: {
              "line-color": "#ffffff",
              "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 8],
            },
            layout: {
              "line-cap": "round",
              "line-join": "round",
            },
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    // Enable all interactions for editing
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Manage POI markers
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;
    const currentMarkers = markersRef.current;
    const poiIds = new Set(pois.map((p) => p.id));

    // Remove markers for POIs that no longer exist
    currentMarkers.forEach((marker, id) => {
      if (!poiIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });

    // Add/update markers for current POIs
    pois.forEach((poi) => {
      const existingMarker = currentMarkers.get(poi.id);

      if (existingMarker) {
        // Update position if marker exists
        existingMarker.setLngLat([poi.lng, poi.lat]);
        // Update content
        const el = existingMarker.getElement();
        const span = el.querySelector("span");
        if (span) span.textContent = String(poi.order);
      } else {
        // Create new marker
        const el = document.createElement("div");
        el.className = "editor-pin";
        el.innerHTML = `
          <div class="w-10 h-10 bg-green-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform">
            <span class="text-white text-lg font-bold">${poi.order}</span>
          </div>
        `;

        if (onPOIClick) {
          el.addEventListener("click", () => onPOIClick(poi));
        }

        const marker = new maplibregl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([poi.lng, poi.lat])
          .addTo(map);

        currentMarkers.set(poi.id, marker);
      }
    });
  }, [pois, mapReady, onPOIClick]);

  // Fit bounds when POIs change
  const fitBounds = useCallback(() => {
    if (!mapRef.current || pois.length === 0) return;

    const map = mapRef.current;

    if (pois.length === 1) {
      map.flyTo({
        center: [pois[0].lng, pois[0].lat],
        zoom: 15,
      });
    } else {
      let north = -Infinity;
      let south = Infinity;
      let east = -Infinity;
      let west = Infinity;

      for (const poi of pois) {
        if (poi.lat > north) north = poi.lat;
        if (poi.lat < south) south = poi.lat;
        if (poi.lng > east) east = poi.lng;
        if (poi.lng < west) west = poi.lng;
      }

      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        { padding: 60, maxZoom: 15 }
      );
    }
  }, [pois]);

  // Auto-fit when POIs change
  useEffect(() => {
    if (mapReady && pois.length > 0) {
      fitBounds();
    }
  }, [mapReady, pois.length, fitBounds]);

  // Memoize context value
  const contextValue = useMemo(
    () => ({ map: mapRef.current }),
    [mapReady]
  );

  return (
    <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden">
      {mapReady && (
        <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
      )}
    </div>
  );
}

/**
 * Pan map to a specific location
 */
export function usePanTo() {
  const map = useMapLibreFromContext();

  return useCallback(
    (lat: number, lng: number, zoom?: number) => {
      if (!map) return;
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? map.getZoom(),
      });
    },
    [map]
  );
}

function useMapLibreFromContext() {
  const { map } = useMemo(() => ({ map: null as maplibregl.Map | null }), []);
  return map;
}
