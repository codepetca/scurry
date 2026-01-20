"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useVisitorId } from "@/hooks/useVisitorId";
import { Id } from "../../../../convex/_generated/dataModel";
import { MultiplayerGame } from "@/components/MultiplayerGame";
import { GameResults } from "@/components/GameResults";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();
  const { visitorId } = useVisitorId();

  const game = useQuery(api.games.getByCode, { code });
  const players = useQuery(
    api.games.listPlayers,
    game ? { gameId: game._id } : "skip"
  );
  const currentPlayer = useQuery(
    api.games.getPlayer,
    game && visitorId ? { gameId: game._id, visitorId } : "skip"
  );

  const joinGame = useMutation(api.games.join);
  const startGame = useMutation(api.games.start);
  const endGame = useMutation(api.games.end);
  const kickPlayer = useMutation(api.games.kick);
  const updateHostName = useMutation(api.games.updateHostName);

  const [displayName, setDisplayName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  const isHost = game?.hostId === visitorId;
  const isInGame = !!currentPlayer;
  const isLobby = game?.status === "lobby";
  const isActive = game?.status === "active";
  const isEnded = game?.status === "ended";

  // Handle joining the game
  const handleJoin = async () => {
    if (!game || !visitorId || !displayName.trim()) return;

    setIsJoining(true);
    setError("");

    try {
      await joinGame({
        code,
        visitorId,
        displayName: displayName.trim(),
        teamIndex: selectedTeam,
      });
    } catch (e: any) {
      setError(e.message || "Failed to join game");
    } finally {
      setIsJoining(false);
    }
  };

  // Handle starting the game
  const handleStart = async () => {
    if (!game || !visitorId) return;

    try {
      await startGame({
        gameId: game._id,
        hostId: visitorId,
      });
    } catch (e: any) {
      setError(e.message || "Failed to start game");
    }
  };

  // Handle ending the game
  const handleEnd = async () => {
    if (!game || !visitorId) return;

    try {
      await endGame({
        gameId: game._id,
        hostId: visitorId,
      });
    } catch (e: any) {
      setError(e.message || "Failed to end game");
    }
  };

  // Handle kicking a player
  const handleKick = async (playerId: Id<"players">) => {
    if (!game || !visitorId) return;

    try {
      await kickPlayer({
        gameId: game._id,
        hostId: visitorId,
        playerId,
      });
    } catch (e: any) {
      setError(e.message || "Failed to kick player");
    }
  };

  // Copy share link
  const handleShare = async () => {
    const url = `${window.location.origin}/game/${code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Join my Scurry game!",
          text: `Join my scavenger hunt! Code: ${code}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
      }
    } catch (e) {
      // User cancelled share
    }
  };

  // Loading state
  if (game === undefined || !visitorId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Game not found
  if (game === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Game Not Found</h1>
          <p className="text-gray-600 mb-4">Code: {code}</p>
          <button
            onClick={() => router.push("/join")}
            className="text-green-500 underline"
          >
            Try another code
          </button>
        </div>
      </div>
    );
  }

  // Join form (not in game yet)
  if (!isInGame && isLobby) {
    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{game.race?.name}</h1>
            <p className="text-gray-600">Code: {code}</p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-medium text-gray-900 mb-4">Join Game</h2>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full border rounded-lg px-3 py-2"
                maxLength={20}
              />
            </div>

            {game.teamNames.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Team
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {game.teamNames.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedTeam(i)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        selectedTeam === i
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleJoin}
              disabled={isJoining || !displayName.trim()}
              className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors"
            >
              {isJoining ? "Joining..." : "Join Game"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game has ended - show results
  if (isEnded) {
    return <GameResults gameId={game._id} />;
  }

  // Lobby view
  if (isLobby) {
    const playersByTeam = game.teamNames.map((_, i) =>
      players?.filter((p) => p.teamIndex === i) || []
    );

    return (
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{game.race?.name}</h1>
            <p className="text-gray-600">
              {game.mode === "collaborative" ? "Collaborative" : "Competitive"} Game
            </p>
          </div>

          {/* Share code */}
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm text-center">
            <p className="text-sm text-gray-600 mb-1">Share this code:</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-gray-900 mb-3">
              {code}
            </p>
            <button
              onClick={handleShare}
              className="text-green-500 text-sm font-medium"
            >
              Share Link
            </button>
          </div>

          {/* Players */}
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <h2 className="font-medium text-gray-900 mb-3">
              Players ({players?.length || 0})
            </h2>

            {game.teamNames.map((teamName, teamIndex) => (
              <div key={teamIndex} className="mb-4 last:mb-0">
                {game.teamNames.length > 1 && (
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    {teamName}
                  </h3>
                )}
                <div className="space-y-2">
                  {playersByTeam[teamIndex]?.map((player) => (
                    <div
                      key={player._id}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900">{player.displayName}</span>
                        {player.isHost && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Host
                          </span>
                        )}
                      </div>
                      {isHost && !player.isHost && (
                        <button
                          onClick={() => handleKick(player._id)}
                          className="text-red-500 text-sm"
                        >
                          Kick
                        </button>
                      )}
                    </div>
                  ))}
                  {playersByTeam[teamIndex]?.length === 0 && (
                    <p className="text-sm text-gray-400 py-2">No players yet</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Host controls */}
          {isHost && (
            <button
              onClick={handleStart}
              disabled={!players || players.length < 1}
              className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white text-lg font-semibold rounded-xl transition-colors"
            >
              Start Game
            </button>
          )}

          {!isHost && (
            <p className="text-center text-gray-500">
              Waiting for host to start the game...
            </p>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mt-4">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active game - show game play view
  if (isActive) {
    return <MultiplayerGame gameId={game._id} visitorId={visitorId} />;
  }

  return null;
}
