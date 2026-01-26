"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RaceEditor } from "@/components/RaceEditor";

function CreateRaceContent() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") as "collaborative" | "competitive") || "collaborative";

  return <RaceEditor mode={mode} createGameOnSave />;
}

export default function CreateRacePage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <CreateRaceContent />
    </Suspense>
  );
}
