"use client";

import { useEffect, useRef, memo } from "react";
import maplibregl from "maplibre-gl";
import { useMapLibre } from "./MapContext";

interface PinProps {
  lat: number;
  lng: number;
  isCompleted: boolean;
  photoUrl?: string;
  onClick: () => void;
  // Order number to display for uncompleted POIs
  order?: number;
  // Multiplayer: team colors for completed POIs
  teamColors?: string[];
}

export const Pin = memo(function Pin({ lat, lng, isCompleted, photoUrl, onClick, order, teamColors }: PinProps) {
  const map = useMapLibre();
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const onClickRef = useRef(onClick);

  // Keep onClick ref updated
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  // Helper to generate marker HTML content
  const getMarkerContent = (completed: boolean, photo?: string, colors?: string[], orderNum?: number) => {
    if (completed && photo) {
      const primaryTeamColor = colors && colors.length > 0 ? colors[0] : "#22c55e";
      let ringsHtml = "";
      if (colors && colors.length > 1) {
        const ringSize = 4;
        colors.forEach((color, i) => {
          const offset = i * ringSize;
          ringsHtml += `<div class="absolute inset-0 rounded-full" style="border: 3px solid ${color}; margin: -${offset}px;"></div>`;
        });
      }
      return `
        <div class="relative w-16 h-16 rounded-full shadow-lg overflow-visible cursor-pointer transform -translate-y-1 hover:scale-110 transition-transform">
          ${ringsHtml}
          <div class="w-full h-full rounded-full border-4 overflow-hidden" style="border-color: ${primaryTeamColor};">
            <img src="${photo}" class="w-full h-full object-cover" alt="completed" />
          </div>
        </div>
      `;
    }
    const displayText = orderNum !== undefined ? orderNum : "?";
    return `
      <div class="w-12 h-12 bg-gray-400 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer transform -translate-y-1 hover:scale-110 transition-transform">
        <span class="text-white text-xl font-bold">${displayText}</span>
      </div>
    `;
  };

  useEffect(() => {
    if (!map) return;

    // Guard against duplicate markers (React Strict Mode)
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    // Create marker element with initial content
    const el = document.createElement("div");
    el.className = "maplibre-pin";
    el.innerHTML = getMarkerContent(isCompleted, photoUrl, teamColors, order);
    elementRef.current = el;

    // Create marker
    const marker = new maplibregl.Marker({
      element: el,
      anchor: "bottom",
    })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current = marker;

    // Add click handler using ref
    const handleClick = () => onClickRef.current();
    el.addEventListener("click", handleClick);

    return () => {
      el.removeEventListener("click", handleClick);
      marker.remove();
      markerRef.current = null;
      elementRef.current = null;
    };
  }, [map, lat, lng]);

  // Update marker content when completion status changes
  useEffect(() => {
    if (!elementRef.current) return;
    elementRef.current.innerHTML = getMarkerContent(isCompleted, photoUrl, teamColors, order);
  }, [isCompleted, photoUrl, teamColors, order]);

  return null;
});
