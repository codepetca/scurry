"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getTeamColor } from "@/lib/teamColors";

interface GameResultsProps {
  gameId: Id<"games">;
}

export function GameResults({ gameId }: GameResultsProps) {
  const router = useRouter();

  const game = useQuery(api.games.getById, { gameId });
  const pois = useQuery(
    api.pois.listByRace,
    game?.raceId ? { raceId: game.raceId } : "skip"
  );
  const teamCompletions = useQuery(api.completions.listByGameGroupedByTeam, {
    gameId,
  });
  const completions = useQuery(api.completions.listByGame, { gameId });

  // Calculate rankings
  const rankings = useMemo(() => {
    if (!game || !teamCompletions) return [];

    const totalPOIs = pois?.length ?? 0;

    return game.teamNames
      .map((name, index) => {
        const completed = teamCompletions[index] ?? 0;
        const teamCompletionTimes = completions
          ?.filter((c) => c.teamIndex === index)
          .map((c) => c.completedAt) ?? [];
        const lastCompletionTime = Math.max(...teamCompletionTimes, 0);

        return {
          index,
          name,
          completed,
          totalPOIs,
          lastCompletionTime,
          color: getTeamColor(index),
        };
      })
      .sort((a, b) => {
        // Sort by completions (desc), then by time (asc for tie-breaker)
        if (b.completed !== a.completed) {
          return b.completed - a.completed;
        }
        return a.lastCompletionTime - b.lastCompletionTime;
      });
  }, [game, teamCompletions, completions, pois]);

  if (!game || !pois) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const isCollaborative = game.mode === "collaborative";
  const winner = rankings[0];
  const totalCompleted = rankings.reduce((sum, r) => sum + r.completed, 0);
  const allComplete = winner && winner.completed === pois.length;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isCollaborative ? "Game Complete!" : "Game Over!"}
          </h1>
          <p className="text-gray-600">{game.race?.name}</p>
        </div>

        {/* Winner announcement (competitive) */}
        {!isCollaborative && winner && (
          <div className="bg-white rounded-xl p-6 mb-4 shadow-sm text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: winner.color.bg }}
            >
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-1">Winner</p>
            <h2
              className="text-2xl font-bold"
              style={{ color: winner.color.text }}
            >
              {winner.name}
            </h2>
            <p className="text-gray-600 mt-2">
              {winner.completed}/{pois.length} checkpoints
            </p>
          </div>
        )}

        {/* Collaborative celebration */}
        {isCollaborative && (
          <div className="bg-white rounded-xl p-6 mb-4 shadow-sm text-center">
            {allComplete ? (
              <>
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  All Checkpoints Found!
                </h2>
                <p className="text-gray-600">
                  Great teamwork! You found all {pois.length} checkpoints together.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Good Effort!
                </h2>
                <p className="text-gray-600">
                  You found {totalCompleted} of {pois.length} checkpoints.
                </p>
              </>
            )}
          </div>
        )}

        {/* Rankings (competitive) */}
        {!isCollaborative && rankings.length > 1 && (
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <h3 className="font-medium text-gray-900 mb-3">Final Standings</h3>
            <div className="space-y-2">
              {rankings.map((team, rank) => (
                <div
                  key={team.index}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{
                    backgroundColor: rank === 0 ? `${team.color.bg}15` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400 w-6">
                      {rank + 1}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color.bg }}
                    />
                    <span className="font-medium text-gray-900">{team.name}</span>
                  </div>
                  <span className="text-gray-600">
                    {team.completed}/{team.totalPOIs}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back to home */}
        <button
          onClick={() => router.push("/")}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white text-lg font-semibold rounded-xl transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
