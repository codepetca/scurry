"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import dynamic from "next/dynamic";
import { POIModal } from "./POIModal";
import { PhotoCarousel } from "./PhotoCarousel";
import { TeamProgressBar } from "./TeamProgressBar";
import { WinnerModal } from "./WinnerModal";
import { GameTimer } from "./GameTimer";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { getTeamColor } from "@/lib/teamColors";
import { Z_INDEX } from "@/lib/zIndex";

// Dynamic imports to avoid SSR issues with MapLibre
const Map = dynamic(
  () => import("./MapLibre/MapContainer").then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
        <span className="text-gray-500">Loading map...</span>
      </div>
    ),
  }
);

const Pin = dynamic(() => import("./MapLibre/Pin").then((mod) => mod.Pin), {
  ssr: false,
});

interface MultiplayerGameProps {
  gameId: Id<"games">;
  visitorId: string;
}

interface POIData {
  _id: Id<"pois">;
  lat: number;
  lng: number;
  clue: string;
  order: number;
}

// Compute bounds from POIs when race bounds are missing
function computeDefaultBounds(pois: POIData[]) {
  if (pois.length === 0) {
    // Fallback to a default location (won't happen in practice)
    return { north: 0, south: 0, east: 0, west: 0 };
  }

  const lats = pois.map((p) => p.lat);
  const lngs = pois.map((p) => p.lng);
  const padding = 0.01; // ~1km padding

  return {
    north: Math.max(...lats) + padding,
    south: Math.min(...lats) - padding,
    east: Math.max(...lngs) + padding,
    west: Math.min(...lngs) - padding,
  };
}

export function MultiplayerGame({ gameId, visitorId }: MultiplayerGameProps) {
  const [selectedPOI, setSelectedPOI] = useState<POIData | null>(null);
  const [viewingPOI, setViewingPOI] = useState<Id<"pois"> | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showWinner, setShowWinner] = useState(false);

  // Queries
  const game = useQuery(api.games.getById, { gameId });
  const currentPlayer = useQuery(api.games.getPlayer, { gameId, visitorId });
  const pois = useQuery(
    api.pois.listByRace,
    game?.raceId ? { raceId: game.raceId } : "skip"
  );
  const completions = useQuery(api.completions.listByGame, { gameId });

  // Mutations
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createCompletion = useMutation(api.completions.createForGame);
  const endGame = useMutation(api.games.end);

  // Compute team completions client-side (avoids duplicate query)
  const teamCompletions = useMemo(() => {
    if (!completions) return {};

    const teamPois: Record<number, Set<string>> = {};

    for (const completion of completions) {
      const teamIndex = completion.teamIndex ?? 0;
      if (!teamPois[teamIndex]) {
        teamPois[teamIndex] = new Set();
      }
      teamPois[teamIndex].add(completion.poiId);
    }

    const result: Record<number, number> = {};
    for (const [teamIndex, poiSet] of Object.entries(teamPois)) {
      result[Number(teamIndex)] = poiSet.size;
    }

    return result;
  }, [completions]);

  // Group completions by POI with team colors
  const poiCompletions = useMemo(() => {
    if (!completions) return {};

    const grouped: Record<string, { teamIndices: number[]; photoId: Id<"_storage"> }> = {};

    for (const completion of completions) {
      const poiId = completion.poiId;
      if (!grouped[poiId]) {
        grouped[poiId] = { teamIndices: [], photoId: completion.photoId };
      }
      const teamIndex = completion.teamIndex ?? 0;
      if (!grouped[poiId].teamIndices.includes(teamIndex)) {
        grouped[poiId].teamIndices.push(teamIndex);
      }
    }

    return grouped;
  }, [completions]);

  // Collect unique photo IDs for batch query
  const photoIds = useMemo(() => {
    return Object.values(poiCompletions)
      .map((p) => p.photoId)
      .filter((id): id is Id<"_storage"> => !!id);
  }, [poiCompletions]);

  // Batch query for all photo URLs (reduces N+1 queries)
  const photoUrls = useQuery(
    api.files.getUrls,
    photoIds.length > 0 ? { storageIds: photoIds } : "skip"
  );

  // Check if current player's team has completed a POI
  const hasTeamCompleted = (poiId: Id<"pois">) => {
    if (!currentPlayer) return false;
    const poiData = poiCompletions[poiId];
    return poiData?.teamIndices.includes(currentPlayer.teamIndex) ?? false;
  };

  // Get team colors for a POI
  const getPoiTeamColors = (poiId: Id<"pois">) => {
    const poiData = poiCompletions[poiId];
    if (!poiData) return [];
    return poiData.teamIndices.map((idx) => getTeamColor(idx).ring);
  };

  // Check win condition
  const totalPOIs = pois?.length ?? 0;
  const isHost = game?.hostId === visitorId;

  // Find winning team (first to complete all POIs)
  const winningTeam = useMemo(() => {
    if (!game || totalPOIs === 0) return null;

    for (let i = 0; i < game.teamNames.length; i++) {
      if ((teamCompletions[i] ?? 0) >= totalPOIs) {
        return { index: i, name: game.teamNames[i] };
      }
    }
    return null;
  }, [teamCompletions, game, totalPOIs]);

  // Track the first winning team to prevent flickering from rapid updates
  const [lockedWinner, setLockedWinner] = useState<{ index: number; name: string } | null>(null);

  // Lock in the winner once detected (prevents race condition from rapid updates)
  useEffect(() => {
    if (winningTeam && !lockedWinner) {
      setLockedWinner(winningTeam);
      const timer = setTimeout(() => setShowWinner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [winningTeam, lockedWinner]);

  // Photo upload handler
  const handlePhotoCapture = async (file: File) => {
    if (!selectedPOI) return;

    setUploadError(null);

    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Failed to upload photo");
      }

      const { storageId } = await result.json();

      // Create completion
      await createCompletion({
        gameId,
        visitorId,
        poiId: selectedPOI._id,
        photoId: storageId,
      });

      setSelectedPOI(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload photo");
    }
  };

  // Handle ending the game
  const handleEndGame = async () => {
    if (!isHost) return;
    await endGame({ gameId, hostId: visitorId });
  };

  // Loading state
  if (!game || !pois || !currentPlayer) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {/* Map */}
      <MapErrorBoundary>
        <Map bounds={game.race?.bounds ?? computeDefaultBounds(pois)}>
        {pois.map((poi) => {
          const isCompleted = !!poiCompletions[poi._id];
          const teamColors = getPoiTeamColors(poi._id);
          const poiData = poiCompletions[poi._id];
          // Get pre-fetched URL from batch query
          const photoUrl = poiData?.photoId && photoUrls
            ? photoUrls[poiData.photoId] ?? undefined
            : undefined;

          return (
            <Pin
              key={poi._id}
              lat={poi.lat}
              lng={poi.lng}
              isCompleted={isCompleted}
              photoUrl={photoUrl}
              teamColors={teamColors}
              onClick={() => {
                if (isCompleted) {
                  // View photos for this POI
                  setViewingPOI(poi._id);
                } else if (!hasTeamCompleted(poi._id)) {
                  // Open capture modal
                  setSelectedPOI(poi);
                }
              }}
            />
          );
        })}
        </Map>
      </MapErrorBoundary>

      {/* Team Progress Bars */}
      <TeamProgressBar
        teamNames={game.teamNames}
        teamCompletions={teamCompletions}
        totalPOIs={totalPOIs}
      />

      {/* Game Timer (if time limit set) */}
      {game.timeLimit && game.startedAt && (
        <GameTimer
          startedAt={game.startedAt}
          timeLimitMinutes={game.timeLimit}
          onExpire={isHost ? handleEndGame : undefined}
        />
      )}

      {/* Host End Game Button */}
      {isHost && (
        <button
          onClick={handleEndGame}
          className="absolute bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg"
          style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
        >
          End Game
        </button>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div
          className="absolute bottom-20 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-center"
          style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
        >
          {uploadError}
          <button
            onClick={() => setUploadError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* POI Modal */}
      {selectedPOI && (
        <POIModal
          clue={selectedPOI.clue}
          onClose={() => setSelectedPOI(null)}
          onPhotoCapture={handlePhotoCapture}
        />
      )}

      {/* Photo Carousel */}
      {viewingPOI && (
        <PhotoCarousel
          gameId={gameId}
          poiId={viewingPOI}
          teamNames={game.teamNames}
          onClose={() => setViewingPOI(null)}
        />
      )}

      {/* Winner Modal (with delay) */}
      {showWinner && lockedWinner && game.mode === "competitive" && (
        <WinnerModal
          winnerName={lockedWinner.name}
          winnerColor={getTeamColor(lockedWinner.index).bg}
          onClose={isHost ? handleEndGame : undefined}
        />
      )}
    </div>
  );
}
