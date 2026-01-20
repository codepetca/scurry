"use client";

interface WinnerModalProps {
  winnerName: string;
  winnerColor: string;
  onClose?: () => void;
}

export function WinnerModal({ winnerName, winnerColor, onClose }: WinnerModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center">
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

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Winner!</h2>
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
