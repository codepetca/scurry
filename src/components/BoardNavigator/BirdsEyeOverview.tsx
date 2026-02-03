"use client";

import { Z_INDEX } from "@/lib/zIndex";
import type { ZoneWithPOIs } from "./types";

interface BirdsEyeOverviewProps {
  zones: ZoneWithPOIs[];
  currentIndex: number;
  onZoneSelect: (index: number) => void;
  onClose: () => void;
}

export function BirdsEyeOverview({
  zones,
  currentIndex,
  onZoneSelect,
  onClose,
}: BirdsEyeOverviewProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Zone overview"
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
        style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          All Zones
        </h2>

        {/* Zone grid */}
        <div className="grid grid-cols-3 gap-3">
          {zones.map((zone, index) => {
            const isActive = index === currentIndex;
            const isComplete =
              zone.completedCount === zone.pois.length && zone.pois.length > 0;
            const progress =
              zone.pois.length > 0
                ? (zone.completedCount / zone.pois.length) * 100
                : 0;

            return (
              <button
                key={zone.id}
                onClick={() => {
                  onZoneSelect(index);
                  onClose();
                }}
                className={`
                  relative aspect-square rounded-xl p-3 transition-all duration-200
                  ${isActive ? "ring-2 ring-blue-500 ring-offset-2" : ""}
                  ${isComplete ? "bg-green-100" : "bg-gray-100"}
                  hover:scale-105
                `}
              >
                {/* Zone number */}
                <span
                  className={`
                    text-2xl font-bold
                    ${isComplete ? "text-green-600" : "text-gray-400"}
                  `}
                >
                  {index + 1}
                </span>

                {/* Progress indicator */}
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isComplete ? "bg-green-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mt-1 block">
                    {zone.completedCount}/{zone.pois.length}
                  </span>
                </div>

                {/* Checkmark for complete zones */}
                {isComplete && (
                  <div className="absolute top-2 right-2">
                    <CheckIcon />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-green-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
