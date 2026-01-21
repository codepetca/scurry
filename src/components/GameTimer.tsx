"use client";

import { useState, useEffect, useRef } from "react";
import { Z_INDEX } from "@/lib/zIndex";

interface GameTimerProps {
  startedAt: number;
  timeLimitMinutes: number;
  onExpire?: () => void;
}

export function GameTimer({
  startedAt,
  timeLimitMinutes,
  onExpire,
}: GameTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  // Keep onExpire ref updated
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    const endTime = startedAt + timeLimitMinutes * 60 * 1000;
    hasExpiredRef.current = false;

    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);

      if (remaining === 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  const isLow = timeLeft < 5 * 60 * 1000; // Less than 5 minutes
  const isCritical = timeLeft < 60 * 1000; // Less than 1 minute

  return (
    <div
      className={`absolute top-16 right-4 px-3 py-1 rounded-lg shadow-lg font-mono text-lg ${
        isCritical
          ? "bg-red-500 text-white animate-pulse"
          : isLow
          ? "bg-orange-500 text-white"
          : "bg-white/90 text-gray-900"
      }`}
      style={{ zIndex: Z_INDEX.MAP_CONTROLS }}
      role="timer"
      aria-live={isCritical ? "assertive" : "polite"}
      aria-label={`Time remaining: ${minutes} minutes and ${seconds} seconds`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
