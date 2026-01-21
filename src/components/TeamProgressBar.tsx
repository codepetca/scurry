"use client";

import { getTeamColor } from "@/lib/teamColors";
import { Z_INDEX } from "@/lib/zIndex";

interface TeamProgressBarProps {
  teamNames: string[];
  teamCompletions: Record<number, number>;
  totalPOIs: number;
}

export function TeamProgressBar({
  teamNames,
  teamCompletions,
  totalPOIs,
}: TeamProgressBarProps) {
  return (
    <div
      className="absolute top-0 left-0 right-0 bg-white/90 backdrop-blur-sm px-4 py-2"
      style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
    >
      <div className="max-w-md mx-auto space-y-1">
        {teamNames.map((name, index) => {
          const completed = teamCompletions[index] ?? 0;
          const percent = totalPOIs > 0 ? (completed / totalPOIs) * 100 : 0;
          const color = getTeamColor(index);

          return (
            <div key={index} className="flex items-center gap-2">
              <span
                className="text-xs font-medium w-20 truncate"
                style={{ color: color.text }}
                id={`team-${index}-label`}
              >
                {name}
              </span>
              <div
                className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={completed}
                aria-valuemin={0}
                aria-valuemax={totalPOIs}
                aria-labelledby={`team-${index}-label`}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color.bg,
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 w-10 text-right" aria-hidden="true">
                {completed}/{totalPOIs}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
