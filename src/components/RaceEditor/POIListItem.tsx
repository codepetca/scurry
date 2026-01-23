"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";

export interface EditorPOI {
  id: string;
  lat: number;
  lng: number;
  name: string;
  clue: string;
  validationType: "PHOTO_ONLY" | "GPS_RADIUS" | "QR_CODE" | "MANUAL";
}

interface POIListItemProps {
  poi: EditorPOI;
  index: number;
  onClueChange: (id: string, clue: string) => void;
  onDelete: (id: string) => void;
  error?: string;
}

export function POIListItem({
  poi,
  index,
  onClueChange,
  onDelete,
  error,
}: POIListItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: poi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border ${
        error ? "border-red-300" : "border-gray-200"
      } p-4 ${isDragging ? "shadow-lg opacity-90" : ""}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Order number */}
        <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-sm">{index + 1}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{poi.name}</div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {poi.lat.toFixed(5)}, {poi.lng.toFixed(5)}
          </div>

          {/* Clue textarea */}
          <textarea
            value={poi.clue}
            onChange={(e) => onClueChange(poi.id, e.target.value)}
            placeholder="Enter a clue for this location..."
            rows={2}
            className={`mt-2 w-full px-3 py-2 text-sm bg-gray-50 border ${
              error ? "border-red-300" : "border-gray-200"
            } rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none`}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => onDelete(poi.id)}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
