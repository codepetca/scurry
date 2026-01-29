/**
 * Shared validators and utilities for Convex mutations
 */
import { v } from "convex/values";

/**
 * Validation type for POI completion methods
 */
export const validationType = v.union(
  v.literal("PHOTO_ONLY"),
  v.literal("GPS_RADIUS"),
  v.literal("QR_CODE"),
  v.literal("MANUAL")
);

/**
 * POI data validator for bulk operations
 */
export const poiData = v.object({
  lat: v.number(),
  lng: v.number(),
  name: v.optional(v.string()),
  clue: v.string(),
  validationType,
});

/**
 * Bounds type for map viewport
 */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Calculate bounding box from array of coordinates
 */
export function calculateBounds(
  points: { lat: number; lng: number }[]
): Bounds {
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;

  for (const point of points) {
    if (point.lat > north) north = point.lat;
    if (point.lat < south) south = point.lat;
    if (point.lng > east) east = point.lng;
    if (point.lng < west) west = point.lng;
  }

  return { north, south, east, west };
}
