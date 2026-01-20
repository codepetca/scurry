"use client";

import { useState, useEffect } from "react";

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

  useEffect(() => {
    const endTime = startedAt + timeLimitMinutes * 60 * 1000;

    const updateTimer = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);

      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes, onExpire]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  const isLow = timeLeft < 5 * 60 * 1000; // Less than 5 minutes
  const isCritical = timeLeft < 60 * 1000; // Less than 1 minute

  return (
    <div
      className={`absolute top-16 right-4 px-3 py-1 rounded-lg shadow-lg z-10 font-mono text-lg ${
        isCritical
          ? "bg-red-500 text-white animate-pulse"
          : isLow
          ? "bg-orange-500 text-white"
          : "bg-white/90 text-gray-900"
      }`}
    >
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
