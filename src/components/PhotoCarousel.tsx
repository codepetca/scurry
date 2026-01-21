"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getTeamColor } from "@/lib/teamColors";
import { Z_INDEX } from "@/lib/zIndex";

interface PhotoCarouselProps {
  gameId: Id<"games">;
  poiId: Id<"pois">;
  teamNames: string[];
  onClose: () => void;
}

export function PhotoCarousel({
  gameId,
  poiId,
  teamNames,
  onClose,
}: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and keyboard navigation
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + (completions?.length || 1)) % (completions?.length || 1));
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % (completions?.length || 1));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const completions = useQuery(api.completions.listByGameAndPoi, {
    gameId,
    poiId,
  });

  // Clamp currentIndex if completions change
  useEffect(() => {
    if (completions && currentIndex >= completions.length) {
      setCurrentIndex(Math.max(0, completions.length - 1));
    }
  }, [completions, currentIndex]);

  if (!completions || completions.length === 0) {
    return null;
  }

  // Safe access with bounds check
  const safeIndex = Math.min(currentIndex, completions.length - 1);
  const currentCompletion = completions[safeIndex];
  const teamIndex = currentCompletion?.teamIndex ?? 0;
  const teamColor = getTeamColor(teamIndex);
  const teamName = teamNames[teamIndex] ?? `Team ${teamIndex + 1}`;

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % completions.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + completions.length) % completions.length);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo carousel: ${currentCompletion?.playerName}'s photo`}
      style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative max-w-lg w-full mx-4 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="bg-white rounded-t-xl px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: `3px solid ${teamColor.bg}` }}
        >
          <div>
            <p className="font-medium text-gray-900">
              {currentCompletion?.playerName}
            </p>
            <p className="text-sm" style={{ color: teamColor.text }}>
              {teamName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close photo carousel"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Photo */}
        <PhotoImage photoId={currentCompletion?.photoId} />

        {/* Navigation */}
        {completions.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow"
              aria-label="Previous photo"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow"
              aria-label="Next photo"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Dots indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" role="tablist" aria-label="Photo navigation">
              {completions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? "bg-white" : "bg-white/50"
                  }`}
                  role="tab"
                  aria-selected={i === currentIndex}
                  aria-label={`Go to photo ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Helper component to load photo URL
function PhotoImage({ photoId }: { photoId?: Id<"_storage"> }) {
  const photoUrl = useQuery(
    api.files.getUrl,
    photoId ? { storageId: photoId } : "skip"
  );

  if (!photoUrl) {
    return (
      <div className="aspect-square bg-gray-200 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt="Completed POI"
      className="w-full aspect-square object-cover rounded-b-xl"
    />
  );
}
