/**
 * Zone Planner Engine
 * Clusters POIs into geographic zones for better map visualization
 * Pure functions - no side effects
 */

import type { Bounds, Coordinate, MapSize } from "../types";
import { calculateBounds, calculateCenter, calculateZoom } from "../mapPlanner";

// ============================================================================
// Types
// ============================================================================

export interface ZoneConfig {
  /** Minimum POIs per zone (default: 3) */
  minPoisPerZone?: number;
  /** Maximum POIs per zone (default: 10) */
  maxPoisPerZone?: number;
  /** Maximum distance in meters for POIs to be in same cluster (default: 1000) */
  clusterRadiusMeters?: number;
  /** Map size for zoom calculation (default: 400x600) */
  mapSize?: MapSize;
}

export interface Zone {
  /** Unique zone identifier */
  id: string;
  /** POIs in this zone (by index from original array) */
  poiIndices: number[];
  /** Bounding box for this zone */
  bounds: Bounds;
  /** Center point of the zone */
  center: Coordinate;
  /** Recommended zoom level for this zone */
  zoom: number;
}

interface POILike {
  lat: number;
  lng: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<ZoneConfig> = {
  minPoisPerZone: 3,
  maxPoisPerZone: 10,
  clusterRadiusMeters: 1000, // 1km default radius
  mapSize: { width: 400, height: 600 },
};

const EARTH_RADIUS_METERS = 6371000;

// ============================================================================
// Distance Calculation
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

// ============================================================================
// Clustering Algorithm
// ============================================================================

/**
 * Simple greedy clustering algorithm based on geographic proximity
 *
 * Algorithm:
 * 1. Sort POIs by latitude (north to south) for deterministic ordering
 * 2. Start with first unassigned POI as cluster seed
 * 3. Add nearby POIs to cluster until max size or no more nearby
 * 4. Repeat until all POIs assigned
 */
function clusterPOIs(
  pois: POILike[],
  config: Required<ZoneConfig>
): number[][] {
  if (pois.length === 0) return [];

  const { clusterRadiusMeters, minPoisPerZone, maxPoisPerZone } = config;

  // Create index array sorted by latitude (deterministic ordering)
  const sortedIndices = pois
    .map((_, i) => i)
    .sort((a, b) => pois[b].lat - pois[a].lat); // North to south

  const assigned = new Set<number>();
  const clusters: number[][] = [];

  for (const seedIndex of sortedIndices) {
    if (assigned.has(seedIndex)) continue;

    // Start new cluster with this POI
    const cluster: number[] = [seedIndex];
    assigned.add(seedIndex);

    const seedPoi = pois[seedIndex];

    // Find all unassigned POIs within radius
    const candidates: Array<{ index: number; distance: number }> = [];

    for (const candidateIndex of sortedIndices) {
      if (assigned.has(candidateIndex)) continue;

      const candidatePoi = pois[candidateIndex];
      const distance = haversineDistance(
        seedPoi.lat,
        seedPoi.lng,
        candidatePoi.lat,
        candidatePoi.lng
      );

      if (distance <= clusterRadiusMeters) {
        candidates.push({ index: candidateIndex, distance });
      }
    }

    // Sort candidates by distance and add up to max size
    candidates.sort((a, b) => a.distance - b.distance);

    for (const candidate of candidates) {
      if (cluster.length >= maxPoisPerZone) break;
      cluster.push(candidate.index);
      assigned.add(candidate.index);
    }

    clusters.push(cluster);
  }

  // Post-process: merge small clusters if possible
  return mergeSmallClusters(clusters, pois, config);
}

/**
 * Merge clusters that are too small with their nearest neighbor
 * Only merges if clusters are within reasonable distance
 */
function mergeSmallClusters(
  clusters: number[][],
  pois: POILike[],
  config: Required<ZoneConfig>
): number[][] {
  const { minPoisPerZone, maxPoisPerZone, clusterRadiusMeters } = config;

  // If only one cluster, return as-is
  if (clusters.length <= 1) return clusters;

  // Max merge distance: 3x the cluster radius (don't merge distant clusters)
  const maxMergeDistance = clusterRadiusMeters * 3;

  // Calculate center of each cluster
  const getClusterCenter = (cluster: number[]) => {
    const lats = cluster.map((i) => pois[i].lat);
    const lngs = cluster.map((i) => pois[i].lng);
    return {
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    };
  };

  // Work with mutable cluster list
  let workingClusters = clusters.map((c) => [...c]);
  let changed = true;

  while (changed) {
    changed = false;

    for (let i = 0; i < workingClusters.length; i++) {
      if (workingClusters[i].length >= minPoisPerZone) continue;

      const centerI = getClusterCenter(workingClusters[i]);
      let bestMergeIndex = -1;
      let bestDistance = Infinity;

      for (let j = 0; j < workingClusters.length; j++) {
        if (i === j) continue;

        // Check if merge would exceed max size
        const combinedSize = workingClusters[i].length + workingClusters[j].length;
        if (combinedSize > maxPoisPerZone) continue;

        const centerJ = getClusterCenter(workingClusters[j]);
        const distance = haversineDistance(
          centerI.lat,
          centerI.lng,
          centerJ.lat,
          centerJ.lng
        );

        // Only merge if within max merge distance
        if (distance < bestDistance && distance <= maxMergeDistance) {
          bestDistance = distance;
          bestMergeIndex = j;
        }
      }

      if (bestMergeIndex !== -1) {
        // Merge clusters
        workingClusters[i] = [...workingClusters[i], ...workingClusters[bestMergeIndex]];
        workingClusters.splice(bestMergeIndex, 1);
        changed = true;
        break; // Restart the loop
      }
    }
  }

  return workingClusters;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Plan zones from an array of POIs
 *
 * @param pois - Array of POIs with lat/lng coordinates
 * @param config - Optional configuration for zone planning
 * @returns Array of zones with bounds, center, and zoom
 *
 * @example
 * ```typescript
 * const pois = [
 *   { lat: 43.65, lng: -79.38 },
 *   { lat: 43.66, lng: -79.39 },
 *   // ...
 * ];
 * const zones = planZones(pois);
 * // => [{ id: "zone-0", poiIndices: [0, 1], bounds: {...}, center: {...}, zoom: 15 }]
 * ```
 */
export function planZones<T extends POILike>(
  pois: T[],
  config?: ZoneConfig
): Zone[] {
  if (pois.length === 0) {
    return [];
  }

  const mergedConfig: Required<ZoneConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Cluster POIs
  const clusters = clusterPOIs(pois, mergedConfig);

  // Convert clusters to zones
  const zones: Zone[] = clusters.map((poiIndices, index) => {
    const clusterPois = poiIndices.map((i) => pois[i]);
    const coordinates = clusterPois.map((p) => ({ lat: p.lat, lng: p.lng }));

    const bounds = calculateBounds(coordinates);
    const center = calculateCenter(bounds);
    const zoom = calculateZoom(bounds, mergedConfig.mapSize);

    return {
      id: `zone-${index}`,
      poiIndices,
      bounds,
      center,
      zoom,
    };
  });

  // Sort zones by their northernmost POI (top to bottom, left to right)
  zones.sort((a, b) => {
    const aNorth = a.bounds.north;
    const bNorth = b.bounds.north;
    if (Math.abs(aNorth - bNorth) > 0.01) {
      return bNorth - aNorth; // North to south
    }
    return a.bounds.west - b.bounds.west; // West to east
  });

  // Re-assign IDs after sorting
  zones.forEach((zone, index) => {
    zone.id = `zone-${index}`;
  });

  return zones;
}

/**
 * Get POIs for a specific zone
 * Utility function to extract POIs from a zone
 */
export function getZonePOIs<T extends POILike>(pois: T[], zone: Zone): T[] {
  return zone.poiIndices.map((i) => pois[i]);
}

/**
 * Calculate total span of all zones
 * Useful for birds-eye overview
 */
export function calculateOverallBounds(zones: Zone[]): Bounds | null {
  if (zones.length === 0) return null;

  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;

  for (const zone of zones) {
    if (zone.bounds.north > north) north = zone.bounds.north;
    if (zone.bounds.south < south) south = zone.bounds.south;
    if (zone.bounds.east > east) east = zone.bounds.east;
    if (zone.bounds.west < west) west = zone.bounds.west;
  }

  return { north, south, east, west };
}
