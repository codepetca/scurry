"use client";

import { useEffect, useRef } from "react";
import { Z_INDEX } from "@/lib/zIndex";

interface WinnerModalProps {
  winnerName: string;
  winnerColor: string;
  onClose?: () => void;
}

export function WinnerModal({ winnerName, winnerColor, onClose }: WinnerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap and escape key handling
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Focus the dialog on mount
    dialog.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-title"
      style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white rounded-2xl p-8 max-w-sm w-full text-center outline-none"
      >
        <div
          className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ backgroundColor: winnerColor }}
        >
          <svg
            className="w-10 h-10 text-white"
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

        <h2 id="winner-title" className="text-2xl font-bold text-gray-900 mb-2">Winner!</h2>
        <p
          className="text-xl font-semibold mb-6"
          style={{ color: winnerColor }}
        >
          {winnerName}
        </p>

        <p className="text-gray-600 mb-6">
          Congratulations! Your team completed all checkpoints first!
        </p>

        {onClose && (
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors"
          >
            End Game
          </button>
        )}
      </div>
    </div>
  );
}
