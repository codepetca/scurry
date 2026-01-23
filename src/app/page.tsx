"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Scurry</h1>
          <p className="text-gray-600">Photo Scavenger Hunt</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/create"
            className="block w-full py-4 bg-green-500 hover:bg-green-600 text-white text-lg font-semibold rounded-xl transition-colors text-center"
          >
            Create Game
          </Link>

          <Link
            href="/join"
            className="block w-full py-4 bg-white hover:bg-gray-50 text-gray-900 text-lg font-semibold rounded-xl transition-colors text-center border border-gray-200"
          >
            Join Game
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 space-y-3">
          <Link
            href="/races/new"
            className="block text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Create Race
          </Link>
          <Link
            href="/solo"
            className="block text-center text-sm text-gray-500 hover:text-gray-700"
          >
            Play Solo Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
