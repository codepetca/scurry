"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "scurry_recent_races";
const MAX_RACES = 3;

interface POIData {
  lat: number;
  lng: number;
  name?: string;
  clue: string;
  validationType: "PHOTO_ONLY" | "GPS_RADIUS" | "QR_CODE" | "MANUAL";
}

export interface RecentRace {
  id: string;
  name: string;
  pois: POIData[];
  createdAt: number;
}

export function useRecentRaces() {
  const [races, setRaces] = useState<RecentRace[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRaces(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load recent races:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save race to the list (most recent first, max 3)
  const saveRace = useCallback((race: RecentRace) => {
    setRaces((prev) => {
      // Remove any existing entry with same id
      const filtered = prev.filter((r) => r.id !== race.id);
      // Add new race to front
      const updated = [race, ...filtered].slice(0, MAX_RACES);
      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save recent races:", error);
      }
      return updated;
    });
  }, []);

  // Remove a race by id
  const removeRace = useCallback((id: string) => {
    setRaces((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save recent races:", error);
      }
      return updated;
    });
  }, []);

  // Clear all races
  const clearRaces = useCallback(() => {
    setRaces([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear recent races:", error);
    }
  }, []);

  return {
    races,
    isLoaded,
    saveRace,
    removeRace,
    clearRaces,
  };
}
