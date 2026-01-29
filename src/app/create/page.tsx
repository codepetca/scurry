"use client";

import { useRouter } from "next/navigation";

export default function CreateGamePage() {
  const router = useRouter();

  const handleSelectMode = (mode: "collaborative" | "competitive") => {
    router.push(`/create/race?mode=${mode}`);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Game</h1>
        <p className="text-gray-600 mb-6">Choose how you want to play</p>

        {/* Game mode selection */}
        <div className="space-y-4">
          <button
            onClick={() => handleSelectMode("collaborative")}
            className="w-full bg-white rounded-xl p-5 shadow-sm text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Collaborative
            </h2>
            <p className="text-sm text-gray-600">
              Everyone works together as one team to complete the hunt
            </p>
          </button>

          <button
            onClick={() => handleSelectMode("competitive")}
            className="w-full bg-white rounded-xl p-5 shadow-sm text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Competitive
            </h2>
            <p className="text-sm text-gray-600">
              Teams compete against each other to finish first
            </p>
          </button>
        </div>

        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="mt-6 w-full py-3 text-gray-600 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
