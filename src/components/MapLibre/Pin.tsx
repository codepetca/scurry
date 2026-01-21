"use client";

import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { useMapLibre } from "./MapContext";

interface PinProps {
  lat: number;
  lng: number;
  isCompleted: boolean;
  photoUrl?: string;
  onClick: () => void;
  // Multiplayer: team colors for completed POIs
  teamColors?: string[];
}

export function Pin({ lat, lng, isCompleted, photoUrl, onClick, teamColors }: PinProps) {
  const map = useMapLibre();
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const onClickRef = useRef(onClick);

  // Keep onClick ref updated
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!map) return;

    // Create marker element
    const el = document.createElement("div");
    el.className = "maplibre-pin";
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

    if (isCompleted && photoUrl) {
      // Primary team color for the inner photo border (first team to complete)
      const primaryTeamColor = teamColors && teamColors.length > 0 ? teamColors[0] : "#22c55e";

      // Build stacked outer rings for multiplayer (one ring per team)
      let ringsHtml = "";
      if (teamColors && teamColors.length > 1) {
        // Show stacked rings for multiple teams
        const ringSize = 4;
        teamColors.forEach((color, i) => {
          const offset = i * ringSize;
          ringsHtml += `<div class="absolute inset-0 rounded-full" style="border: 3px solid ${color}; margin: -${offset}px;"></div>`;
        });
      }

      elementRef.current.innerHTML = `
        <div class="relative w-16 h-16 rounded-full shadow-lg overflow-visible cursor-pointer transform -translate-y-1 hover:scale-110 transition-transform">
          ${ringsHtml}
          <div class="w-full h-full rounded-full border-4 overflow-hidden" style="border-color: ${primaryTeamColor};">
            <img src="${photoUrl}" class="w-full h-full object-cover" alt="completed" />
          </div>
        </div>
      `;
    } else {
      elementRef.current.innerHTML = `
        <div class="w-14 h-14 bg-gray-400 rounded-full border-4 border-white shadow-lg flex items-center justify-center cursor-pointer transform -translate-y-1 hover:scale-110 transition-transform">
          <span class="text-white text-2xl font-bold">?</span>
        </div>
      `;
    }
  }, [isCompleted, photoUrl, teamColors]);

  return null;
}
