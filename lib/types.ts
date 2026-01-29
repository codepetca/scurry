/**
 * Core types for Wren
 * These are used by engines and components (independent of Convex)
 */

export type ValidationType = "PHOTO_ONLY" | "GPS_RADIUS" | "QR_CODE" | "MANUAL";

export interface POI {
  id: string;
  raceId: string;
  order: number;
  lat: number;
  lng: number;
  name?: string;
  clue: string;
  validationType: ValidationType;
  validationConfig?: {
    radiusMeters?: number;
    qrValue?: string;
  };
}

export interface Race {
  id: string;
  name: string;
  description: string;
  bounds: Bounds;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Completion {
  id: string;
  visitorId: string;
  poiId: string;
  photoUrl: string;
  completedAt: number;
}

export interface Coordinate {
  lat: number;
  lng: number;
}

export interface MapSize {
  width: number;
  height: number;
}
