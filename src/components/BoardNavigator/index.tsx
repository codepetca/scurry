"use client";

import { useState, useCallback } from "react";
import { ZoneView } from "./ZoneView";
import { ZoneIndicator } from "./ZoneIndicator";
import { BirdsEyeOverview } from "./BirdsEyeOverview";
import { useSwipeGesture } from "./useSwipeGesture";
import { Z_INDEX } from "@/lib/zIndex";
import type { BoardNavigatorProps } from "./types";

export { type ZoneWithPOIs, type POIWithCompletion } from "./types";

export function BoardNavigator({
  zones,
  onPOIClick,
  onViewPhoto,
}: BoardNavigatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentZone = zones[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < zones.length - 1;

  // Navigation handlers with transition animation
  const navigateToZone = useCallback(
    (index: number) => {
      if (index < 0 || index >= zones.length || index === currentIndex) return;
      if (isTransitioning) return;

      setIsTransitioning(true);
      setCurrentIndex(index);

      // Reset transition state after animation
      setTimeout(() => setIsTransitioning(false), 300);
    },
    [zones.length, currentIndex, isTransitioning]
  );

  const navigatePrev = useCallback(() => {
    if (hasPrev) navigateToZone(currentIndex - 1);
  }, [hasPrev, currentIndex, navigateToZone]);

  const navigateNext = useCallback(() => {
    if (hasNext) navigateToZone(currentIndex + 1);
  }, [hasNext, currentIndex, navigateToZone]);

  // Swipe gesture handling
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: navigateNext,
    onSwipeRight: navigatePrev,
  });

  // Zone completion data for indicator
  const zoneCompletions = zones.map((z) => z.completedCount);
  const zoneTotals = zones.map((z) => z.pois.length);

  // Handle single zone case
  if (zones.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No zones available</p>
      </div>
    );
  }

  if (zones.length === 1) {
    return (
      <div className="w-full h-full">
        <ZoneView
          zone={currentZone}
          onPOIClick={onPOIClick}
          onViewPhoto={onViewPhoto}
          showNavArrows={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative" {...swipeHandlers}>
      {/* Zone view with transition */}
      <div
        className={`w-full h-full transition-opacity duration-300 ${
          isTransitioning ? "opacity-50" : "opacity-100"
        }`}
      >
        <ZoneView
          zone={currentZone}
          onPOIClick={onPOIClick}
          onViewPhoto={onViewPhoto}
          showNavArrows={true}
          onNavigatePrev={navigatePrev}
          onNavigateNext={navigateNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
      </div>

      {/* Zone indicator */}
      <ZoneIndicator
        currentIndex={currentIndex}
        totalZones={zones.length}
        onDotClick={navigateToZone}
        zoneCompletions={zoneCompletions}
        zoneTotals={zoneTotals}
      />

      {/* Overview button */}
      <button
        onClick={() => setShowOverview(true)}
        className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm text-sm font-medium text-gray-600 hover:bg-white transition-colors"
        style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
        aria-label="View all zones"
      >
        <GridIcon />
      </button>

      {/* Birds-eye overview modal */}
      {showOverview && (
        <BirdsEyeOverview
          zones={zones}
          currentIndex={currentIndex}
          onZoneSelect={navigateToZone}
          onClose={() => setShowOverview(false)}
        />
      )}
    </div>
  );
}

function GridIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}
