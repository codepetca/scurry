"use client";

import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ZoneWithPOIs, POIWithCompletion } from "./types";
import { Z_INDEX } from "@/lib/zIndex";

// Dynamic imports to avoid SSR issues with MapLibre
const Map = dynamic(
  () => import("../MapLibre/MapContainer").then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-500">Loading map...</span>
      </div>
    ),
  }
);

const Pin = dynamic(() => import("../MapLibre/Pin").then((mod) => mod.Pin), {
  ssr: false,
});

interface ZoneViewProps {
  zone: ZoneWithPOIs;
  onPOIClick: (poi: POIWithCompletion) => void;
  onViewPhoto: (url: string) => void;
  showNavArrows?: boolean;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function ZoneView({
  zone,
  onPOIClick,
  onViewPhoto,
  showNavArrows = true,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
}: ZoneViewProps) {
  return (
    <div className="relative w-full h-full">
      {/* Map with pins */}
      <Map bounds={zone.bounds}>
        {zone.pois.map((poi) => (
          <PinWithPhoto
            key={poi._id}
            poi={poi}
            onPOIClick={onPOIClick}
            onViewPhoto={onViewPhoto}
          />
        ))}
      </Map>

      {/* Navigation arrows */}
      {showNavArrows && (
        <>
          {hasPrev && (
            <button
              onClick={onNavigatePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
              style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
              aria-label="Previous zone"
            >
              <ChevronLeftIcon />
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNavigateNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-colors"
              style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
              aria-label="Next zone"
            >
              <ChevronRightIcon />
            </button>
          )}
        </>
      )}

      {/* Zone completion badge */}
      <div
        className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-sm font-medium"
        style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
      >
        <span className="text-green-600">{zone.completedCount}</span>
        <span className="text-gray-400"> / </span>
        <span className="text-gray-600">{zone.pois.length}</span>
        <span className="text-gray-400 ml-1">complete</span>
      </div>
    </div>
  );
}

// Helper component to load photo URL for a pin
function PinWithPhoto({
  poi,
  onPOIClick,
  onViewPhoto,
}: {
  poi: POIWithCompletion;
  onPOIClick: (poi: POIWithCompletion) => void;
  onViewPhoto: (url: string) => void;
}) {
  const photoUrl = useQuery(
    api.files.getUrl,
    poi.completion ? { storageId: poi.completion.photoId } : "skip"
  );

  const handleClick = () => {
    if (poi.completion && photoUrl) {
      onViewPhoto(photoUrl);
    } else if (!poi.completion) {
      onPOIClick(poi);
    }
  };

  return (
    <Pin
      lat={poi.lat}
      lng={poi.lng}
      isCompleted={!!poi.completion}
      photoUrl={photoUrl ?? undefined}
      onClick={handleClick}
    />
  );
}

// Simple chevron icons
function ChevronLeftIcon() {
  return (
    <svg
      className="w-6 h-6 text-gray-700"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="w-6 h-6 text-gray-700"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}
