"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import dynamic from "next/dynamic";
import { POIModal } from "./POIModal";
import { PhotoCarousel } from "./PhotoCarousel";
import { TeamProgressBar } from "./TeamProgressBar";
import { WinnerModal } from "./WinnerModal";
import { GameTimer } from "./GameTimer";
import { getTeamColor } from "@/lib/teamColors";

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

export function MultiplayerGame({ gameId, visitorId }: MultiplayerGameProps) {
  const [selectedPOI, setSelectedPOI] = useState<POIData | null>(null);
  const [viewingPOI, setViewingPOI] = useState<Id<"pois"> | null>(null);

  // Queries
  const game = useQuery(api.games.getById, { gameId });
  const currentPlayer = useQuery(api.games.getPlayer, { gameId, visitorId });
  const pois = useQuery(
    api.pois.listByRace,
    game?.raceId ? { raceId: game.raceId } : "skip"
  );
  const completions = useQuery(api.completions.listByGame, { gameId });
  const teamCompletions = useQuery(api.completions.listByGameGroupedByTeam, {
    gameId,
  });

  // Mutations
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createCompletion = useMutation(api.completions.createForGame);
  const endGame = useMutation(api.games.end);

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
    if (!teamCompletions || !game || totalPOIs === 0) return null;

    for (let i = 0; i < game.teamNames.length; i++) {
      if ((teamCompletions[i] ?? 0) >= totalPOIs) {
        return { index: i, name: game.teamNames[i] };
      }
    }
    return null;
  }, [teamCompletions, game, totalPOIs]);

  // Photo upload handler
  const handlePhotoCapture = async (file: File) => {
    if (!selectedPOI) return;

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
      gameId,
      visitorId,
      poiId: selectedPOI._id,
      photoId: storageId,
    });

    setSelectedPOI(null);
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
      <Map bounds={game.race?.bounds ?? { north: 0, south: 0, east: 0, west: 0 }}>
        {pois.map((poi) => {
          const isCompleted = !!poiCompletions[poi._id];
          const teamColors = getPoiTeamColors(poi._id);
          const poiData = poiCompletions[poi._id];

          return (
            <PinWithPhoto
              key={poi._id}
              poi={poi}
              isCompleted={isCompleted}
              teamColors={teamColors}
              photoId={poiData?.photoId}
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

      {/* Team Progress Bars */}
      <TeamProgressBar
        teamNames={game.teamNames}
        teamCompletions={teamCompletions ?? {}}
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
          className="absolute bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-10"
        >
          End Game
        </button>
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

      {/* Winner Modal */}
      {winningTeam && game.mode === "competitive" && (
        <WinnerModal
          winnerName={winningTeam.name}
          winnerColor={getTeamColor(winningTeam.index).bg}
          onClose={isHost ? handleEndGame : undefined}
        />
      )}
    </div>
  );
}

// Helper component to load photo URL for a pin
function PinWithPhoto({
  poi,
  isCompleted,
  teamColors,
  photoId,
  onClick,
}: {
  poi: POIData;
  isCompleted: boolean;
  teamColors: string[];
  photoId?: Id<"_storage">;
  onClick: () => void;
}) {
  const photoUrl = useQuery(
    api.files.getUrl,
    photoId ? { storageId: photoId } : "skip"
  );

  return (
    <Pin
      lat={poi.lat}
      lng={poi.lng}
      isCompleted={isCompleted}
      photoUrl={photoUrl ?? undefined}
      teamColors={teamColors}
      onClick={onClick}
    />
  );
}
