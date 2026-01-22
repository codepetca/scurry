"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import dynamic from "next/dynamic";
import { POIModal } from "./POIModal";
import { PhotoViewer } from "./PhotoViewer";
import { CompleteScreen } from "./CompleteScreen";
import { ProgressBar } from "./ProgressBar";
import { useVisitorId } from "@/hooks/useVisitorId";

// Dynamic imports to avoid SSR issues with MapLibre
const Map = dynamic(() => import("./MapLibre/MapContainer").then((mod) => mod.Map), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
      <span className="text-gray-500">Loading map...</span>
    </div>
  ),
});

const Pin = dynamic(() => import("./MapLibre/Pin").then((mod) => mod.Pin), {
  ssr: false,
});

interface POIWithCompletion {
  _id: Id<"pois">;
  lat: number;
  lng: number;
  clue: string;
  order: number;
  completion?: {
    photoId: Id<"_storage">;
    photoUrl: string | null;
  };
}

export function Game() {
  const { visitorId, resetVisitorId } = useVisitorId();
  const [selectedPOI, setSelectedPOI] = useState<POIWithCompletion | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  // Queries
  const race = useQuery(api.races.getFirst);
  const pois = useQuery(
    api.pois.listByRace,
    race ? { raceId: race._id } : "skip"
  );
  const completions = useQuery(
    api.completions.listByVisitor,
    visitorId ? { visitorId } : "skip"
  );

  // Mutations
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createCompletion = useMutation(api.completions.create);
  const clearCompletions = useMutation(api.completions.clearByVisitor);

  // Get photo URLs for completions
  const completionPhotoUrls = useMemo(() => {
    const urls: Record<string, string | null> = {};
    completions?.forEach((c) => {
      urls[c.poiId] = null; // Will be filled by individual queries
    });
    return urls;
  }, [completions]);

  // Combine POIs with their completion status
  const poisWithCompletions: POIWithCompletion[] = useMemo(() => {
    if (!pois || !completions) return [];

    return pois.map((poi) => {
      const completion = completions.find((c) => c.poiId === poi._id);
      return {
        ...poi,
        completion: completion
          ? {
              photoId: completion.photoId,
              photoUrl: null, // Will be loaded separately
            }
          : undefined,
      };
    });
  }, [pois, completions]);

  const completedCount = completions?.length ?? 0;
  const totalCount = pois?.length ?? 0;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  // Photo upload handler
  const handlePhotoCapture = async (file: File) => {
    if (!selectedPOI || !visitorId) return;

    // Get upload URL
    const uploadUrl = await generateUploadUrl();

    // Upload file
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await result.json();

    // Create completion
    await createCompletion({
      visitorId,
      poiId: selectedPOI._id,
      photoId: storageId,
    });

    setSelectedPOI(null);

    // Check if all complete
    if (completedCount + 1 === totalCount) {
      setTimeout(() => setShowComplete(true), 500);
    }
  };

  // Play again handler
  const handlePlayAgain = async () => {
    if (!visitorId) return;
    await clearCompletions({ visitorId });
    setShowComplete(false);
  };

  // Loading state
  if (!race || !pois || !visitorId) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading race...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {/* Map */}
      <Map bounds={race.bounds}>
        {poisWithCompletions.map((poi) => (
          <PinWithPhoto
            key={poi._id}
            poi={poi}
            onClick={() => {
              if (poi.completion) {
                // View photo
              } else {
                setSelectedPOI(poi);
              }
            }}
            onViewPhoto={setViewingPhoto}
          />
        ))}
      </Map>

      {/* Progress bar */}
      <ProgressBar completed={completedCount} total={totalCount} />

      {/* POI Modal */}
      {selectedPOI && (
        <POIModal
          clue={selectedPOI.clue}
          onClose={() => setSelectedPOI(null)}
          onPhotoCapture={handlePhotoCapture}
        />
      )}

      {/* Photo Viewer */}
      {viewingPhoto && (
        <PhotoViewer
          photoUrl={viewingPhoto}
          onClose={() => setViewingPhoto(null)}
        />
      )}

      {/* Complete Screen */}
      {showComplete && completions && (
        <CompleteScreenWithPhotos
          completions={completions}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}

// Helper component to load photo URL for a pin
function PinWithPhoto({
  poi,
  onClick,
  onViewPhoto,
}: {
  poi: POIWithCompletion;
  onClick: () => void;
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
      onClick();
    }
  };

  return (
    <Pin
      lat={poi.lat}
      lng={poi.lng}
      isCompleted={!!poi.completion}
      photoUrl={photoUrl ?? undefined}
      onClick={handleClick}
      order={poi.order}
    />
  );
}

// Helper component to load all photo URLs for complete screen
function CompleteScreenWithPhotos({
  completions,
  onPlayAgain,
}: {
  completions: Array<{ photoId: Id<"_storage"> }>;
  onPlayAgain: () => void;
}) {
  const photoUrls = completions.map((c) => {
    const url = useQuery(api.files.getUrl, { storageId: c.photoId });
    return url;
  });

  const loadedUrls = photoUrls.filter((url): url is string => url !== null && url !== undefined);

  if (loadedUrls.length !== completions.length) {
    return null; // Still loading
  }

  return <CompleteScreen photoUrls={loadedUrls} onPlayAgain={onPlayAgain} />;
}
