"use client";

import { Z_INDEX } from "@/lib/zIndex";

interface ZoneIndicatorProps {
  currentIndex: number;
  totalZones: number;
  onDotClick?: (index: number) => void;
  zoneCompletions?: number[]; // Completed POI count per zone
  zoneTotals?: number[]; // Total POI count per zone
}

export function ZoneIndicator({
  currentIndex,
  totalZones,
  onDotClick,
  zoneCompletions,
  zoneTotals,
}: ZoneIndicatorProps) {
  if (totalZones <= 1) return null;

  return (
    <div
      className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md"
      style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
    >
      {/* Zone dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalZones }).map((_, index) => {
          const isActive = index === currentIndex;
          const isComplete =
            zoneCompletions &&
            zoneTotals &&
            zoneCompletions[index] === zoneTotals[index] &&
            zoneTotals[index] > 0;

          return (
            <button
              key={index}
              onClick={() => onDotClick?.(index)}
              className={`
                w-3 h-3 rounded-full transition-all duration-200
                ${isActive ? "scale-125" : "hover:scale-110"}
                ${
                  isComplete
                    ? "bg-green-500"
                    : isActive
                      ? "bg-gray-800"
                      : "bg-gray-300"
                }
              `}
              aria-label={`Go to zone ${index + 1}`}
              aria-current={isActive ? "true" : undefined}
            />
          );
        })}
      </div>

      {/* Zone counter */}
      <span className="text-sm font-medium text-gray-600 ml-2">
        {currentIndex + 1}/{totalZones}
      </span>
    </div>
  );
}
