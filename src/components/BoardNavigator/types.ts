/**
 * BoardNavigator Types
 */

import type { Zone } from "@/../lib/engines/zonePlanner";
import type { Id } from "../../../convex/_generated/dataModel";

export interface POIWithCompletion {
  _id: Id<"pois">;
  lat: number;
  lng: number;
  clue: string;
  order: number;
  completion?: {
    photoId: Id<"_storage">;
    photoUrl: string | null;
  };
}

export interface ZoneWithPOIs extends Zone {
  pois: POIWithCompletion[];
  completedCount: number;
}

export interface BoardNavigatorProps {
  zones: ZoneWithPOIs[];
  onPOIClick: (poi: POIWithCompletion) => void;
  onViewPhoto: (url: string) => void;
}
