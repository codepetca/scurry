"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { RaceEditor } from "@/components/RaceEditor";
import { Loader2 } from "lucide-react";

interface EditRacePageProps {
  params: Promise<{ id: string }>;
}

export default function EditRacePage({ params }: EditRacePageProps) {
  const { id } = use(params);
  const raceId = id as Id<"races">;

  const race = useQuery(api.races.get, { id: raceId });
  const pois = useQuery(api.pois.listByRace, { raceId });

  // Loading state
  if (race === undefined || pois === undefined) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading race...</span>
        </div>
      </div>
    );
  }

  // Race not found
  if (race === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Race Not Found
          </h1>
          <p className="text-gray-500">
            The race you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return <RaceEditor initialRace={race} initialPOIs={pois} />;
}
