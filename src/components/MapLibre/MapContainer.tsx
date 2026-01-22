"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Bounds } from "@/../lib/types";
import { MapContext } from "./MapContext";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapProps {
  bounds: Bounds;
  children?: React.ReactNode;
}

// Register PMTiles protocol once
let protocolRegistered = false;

export function Map({ bounds, children }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Register PMTiles protocol
    if (!protocolRegistered) {
      const protocol = new Protocol();
      maplibregl.addProtocol("pmtiles", protocol.tile);
      protocolRegistered = true;
    }

    // Calculate center from bounds
    const center: [number, number] = [
      (bounds.east + bounds.west) / 2,
      (bounds.north + bounds.south) / 2,
    ];

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
            attribution: '<a href="https://protomaps.com">Protomaps</a> | <a href="https://openstreetmap.org">OSM</a>',
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
            filter: ["in", "pmap:kind", "park", "nature_reserve", "garden", "grass", "cemetery"],
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
            filter: ["any",
              ["==", ["get", "kind_detail"], "motorway"],
              ["==", ["get", "kind_detail"], "trunk"]
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
            filter: ["any",
              ["==", ["get", "kind_detail"], "primary"],
              ["==", ["get", "kind_detail"], "secondary"]
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
      center,
      zoom: 13,
    });

    // Lock map completely - no pan or zoom
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();

    // Fit to bounds when loaded
    map.on("load", () => {
      map.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { padding: 60, maxZoom: 15 }
      );
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bounds]);

  // Update bounds when they change
  useEffect(() => {
    if (mapRef.current && mapReady) {
      mapRef.current.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { padding: 60, maxZoom: 15 }
      );
    }
  }, [bounds, mapReady]);

  // Memoize context value to prevent unnecessary re-renders of children
  const contextValue = useMemo(
    () => ({ map: mapRef.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapReady] // Only update when map becomes ready
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      {mapReady && (
        <MapContext.Provider value={contextValue}>
          {children}
        </MapContext.Provider>
      )}
    </div>
  );
}
