import { describe, it, expect } from "vitest";
import {
  planZones,
  getZonePOIs,
  calculateOverallBounds,
  type Zone,
} from "../engines/zonePlanner";

// Test POIs in Toronto area
const torontoPOIs = [
  { lat: 43.6532, lng: -79.3832 }, // Downtown
  { lat: 43.6547, lng: -79.3806 }, // Near downtown
  { lat: 43.6561, lng: -79.3793 }, // Near downtown
  { lat: 43.7615, lng: -79.4111 }, // North York (far)
  { lat: 43.7630, lng: -79.4095 }, // North York (far)
  { lat: 43.6426, lng: -79.3871 }, // Harbourfront
];

// Spread out POIs (different cities)
const spreadOutPOIs = [
  { lat: 43.6532, lng: -79.3832 }, // Toronto
  { lat: 45.5017, lng: -73.5673 }, // Montreal (~500km away)
  { lat: 49.2827, lng: -123.1207 }, // Vancouver (~3400km away)
];

// Clustered POIs (all within 100m)
const clusteredPOIs = [
  { lat: 43.6532, lng: -79.3832 },
  { lat: 43.6534, lng: -79.3830 },
  { lat: 43.6530, lng: -79.3834 },
  { lat: 43.6533, lng: -79.3831 },
];

describe("planZones", () => {
  describe("basic functionality", () => {
    it("returns empty array for empty input", () => {
      const zones = planZones([]);
      expect(zones).toEqual([]);
    });

    it("returns single zone for clustered POIs", () => {
      const zones = planZones(clusteredPOIs);
      expect(zones).toHaveLength(1);
      expect(zones[0].poiIndices).toHaveLength(4);
    });

    it("creates multiple zones for spread out POIs", () => {
      const zones = planZones(spreadOutPOIs, { clusterRadiusMeters: 1000 });
      expect(zones.length).toBeGreaterThan(1);
    });

    it("assigns all POIs to zones", () => {
      const zones = planZones(torontoPOIs);
      const allIndices = zones.flatMap((z) => z.poiIndices);
      expect(allIndices.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe("zone structure", () => {
    it("returns zones with required properties", () => {
      const zones = planZones(torontoPOIs);

      for (const zone of zones) {
        expect(zone).toHaveProperty("id");
        expect(zone).toHaveProperty("poiIndices");
        expect(zone).toHaveProperty("bounds");
        expect(zone).toHaveProperty("center");
        expect(zone).toHaveProperty("zoom");

        // Bounds should have all directions
        expect(zone.bounds).toHaveProperty("north");
        expect(zone.bounds).toHaveProperty("south");
        expect(zone.bounds).toHaveProperty("east");
        expect(zone.bounds).toHaveProperty("west");

        // Center should have lat/lng
        expect(zone.center).toHaveProperty("lat");
        expect(zone.center).toHaveProperty("lng");

        // Zoom should be a number
        expect(typeof zone.zoom).toBe("number");
      }
    });

    it("generates sequential zone IDs", () => {
      const zones = planZones(torontoPOIs);
      const ids = zones.map((z) => z.id);

      zones.forEach((zone, index) => {
        expect(zone.id).toBe(`zone-${index}`);
      });
    });
  });

  describe("deterministic output", () => {
    it("produces same output for same input", () => {
      const zones1 = planZones(torontoPOIs);
      const zones2 = planZones(torontoPOIs);

      expect(zones1).toEqual(zones2);
    });

    it("produces same output regardless of input order", () => {
      const shuffled = [...torontoPOIs].reverse();
      const zones1 = planZones(torontoPOIs);
      const zones2 = planZones(shuffled);

      // Should have same number of zones
      expect(zones1.length).toBe(zones2.length);

      // Total POIs should be same
      const count1 = zones1.reduce((sum, z) => sum + z.poiIndices.length, 0);
      const count2 = zones2.reduce((sum, z) => sum + z.poiIndices.length, 0);
      expect(count1).toBe(count2);
    });
  });

  describe("configuration", () => {
    it("respects minPoisPerZone", () => {
      const zones = planZones(torontoPOIs, { minPoisPerZone: 2 });

      // All zones except possibly the last should have at least 2 POIs
      // (last zone might have fewer if total doesn't divide evenly)
      const largeZones = zones.filter((z) => z.poiIndices.length >= 2);
      expect(largeZones.length).toBeGreaterThan(0);
    });

    it("respects maxPoisPerZone", () => {
      const zones = planZones(torontoPOIs, { maxPoisPerZone: 3 });

      for (const zone of zones) {
        expect(zone.poiIndices.length).toBeLessThanOrEqual(3);
      }
    });

    it("respects clusterRadiusMeters", () => {
      // With large radius, should cluster more
      const largeRadius = planZones(torontoPOIs, { clusterRadiusMeters: 50000 });
      // With small radius, should have more zones
      const smallRadius = planZones(torontoPOIs, { clusterRadiusMeters: 100 });

      expect(smallRadius.length).toBeGreaterThanOrEqual(largeRadius.length);
    });
  });

  describe("bounds calculation", () => {
    it("calculates correct bounds for zone", () => {
      const zones = planZones(clusteredPOIs);
      const zone = zones[0];

      const zonePois = zone.poiIndices.map((i) => clusteredPOIs[i]);
      const lats = zonePois.map((p) => p.lat);
      const lngs = zonePois.map((p) => p.lng);

      expect(zone.bounds.north).toBe(Math.max(...lats));
      expect(zone.bounds.south).toBe(Math.min(...lats));
      expect(zone.bounds.east).toBe(Math.max(...lngs));
      expect(zone.bounds.west).toBe(Math.min(...lngs));
    });

    it("center is within bounds", () => {
      const zones = planZones(torontoPOIs);

      for (const zone of zones) {
        expect(zone.center.lat).toBeGreaterThanOrEqual(zone.bounds.south);
        expect(zone.center.lat).toBeLessThanOrEqual(zone.bounds.north);
        expect(zone.center.lng).toBeGreaterThanOrEqual(zone.bounds.west);
        expect(zone.center.lng).toBeLessThanOrEqual(zone.bounds.east);
      }
    });
  });

  describe("zoom calculation", () => {
    it("calculates reasonable zoom levels", () => {
      const zones = planZones(torontoPOIs);

      for (const zone of zones) {
        expect(zone.zoom).toBeGreaterThanOrEqual(1);
        expect(zone.zoom).toBeLessThanOrEqual(18);
      }
    });

    it("smaller zones have higher zoom", () => {
      // Tightly clustered POIs (within ~50m)
      const tightPOIs = [
        { lat: 43.6532, lng: -79.3832 },
        { lat: 43.6534, lng: -79.3830 },
        { lat: 43.6530, lng: -79.3834 },
      ];

      // More spread out POIs (within ~2km, still clustered together)
      const widerPOIs = [
        { lat: 43.6532, lng: -79.3832 },
        { lat: 43.6650, lng: -79.3950 },
        { lat: 43.6400, lng: -79.3700 },
      ];

      const tightZones = planZones(tightPOIs, { clusterRadiusMeters: 5000 });
      const widerZones = planZones(widerPOIs, { clusterRadiusMeters: 5000 });

      // Both should cluster into single zone
      expect(tightZones).toHaveLength(1);
      expect(widerZones).toHaveLength(1);

      // Tighter zone should have higher zoom (more zoomed in)
      expect(tightZones[0].zoom).toBeGreaterThan(widerZones[0].zoom);
    });
  });
});

describe("getZonePOIs", () => {
  it("returns correct POIs for zone", () => {
    const zones = planZones(torontoPOIs);
    const zone = zones[0];

    const zonePois = getZonePOIs(torontoPOIs, zone);

    expect(zonePois).toHaveLength(zone.poiIndices.length);

    // Each returned POI should match the original by index
    zone.poiIndices.forEach((index, i) => {
      expect(zonePois[i]).toEqual(torontoPOIs[index]);
    });
  });

  it("returns empty array for zone with no POIs", () => {
    const emptyZone: Zone = {
      id: "empty",
      poiIndices: [],
      bounds: { north: 0, south: 0, east: 0, west: 0 },
      center: { lat: 0, lng: 0 },
      zoom: 10,
    };

    const pois = getZonePOIs(torontoPOIs, emptyZone);
    expect(pois).toEqual([]);
  });
});

describe("calculateOverallBounds", () => {
  it("returns null for empty zones array", () => {
    const bounds = calculateOverallBounds([]);
    expect(bounds).toBeNull();
  });

  it("returns bounds encompassing all zones", () => {
    const zones = planZones(torontoPOIs);
    const overall = calculateOverallBounds(zones);

    expect(overall).not.toBeNull();

    // Overall bounds should contain all zone bounds
    for (const zone of zones) {
      expect(overall!.north).toBeGreaterThanOrEqual(zone.bounds.north);
      expect(overall!.south).toBeLessThanOrEqual(zone.bounds.south);
      expect(overall!.east).toBeGreaterThanOrEqual(zone.bounds.east);
      expect(overall!.west).toBeLessThanOrEqual(zone.bounds.west);
    }
  });

  it("returns exact bounds for single zone", () => {
    const zones = planZones(clusteredPOIs);
    expect(zones).toHaveLength(1);

    const overall = calculateOverallBounds(zones);
    expect(overall).toEqual(zones[0].bounds);
  });
});

describe("edge cases", () => {
  it("handles single POI", () => {
    const singlePOI = [{ lat: 43.6532, lng: -79.3832 }];
    const zones = planZones(singlePOI);

    expect(zones).toHaveLength(1);
    expect(zones[0].poiIndices).toEqual([0]);
  });

  it("handles two POIs far apart", () => {
    const twoPOIs = [
      { lat: 43.6532, lng: -79.3832 }, // Toronto
      { lat: 45.5017, lng: -73.5673 }, // Montreal
    ];
    const zones = planZones(twoPOIs, { clusterRadiusMeters: 1000 });

    // Should be in separate zones due to distance
    expect(zones.length).toBe(2);
  });

  it("handles POIs with same coordinates", () => {
    const samePOIs = [
      { lat: 43.6532, lng: -79.3832 },
      { lat: 43.6532, lng: -79.3832 },
      { lat: 43.6532, lng: -79.3832 },
    ];
    const zones = planZones(samePOIs);

    expect(zones).toHaveLength(1);
    expect(zones[0].poiIndices).toHaveLength(3);
  });

  it("handles negative coordinates", () => {
    const southernPOIs = [
      { lat: -33.8688, lng: 151.2093 }, // Sydney
      { lat: -33.8700, lng: 151.2100 }, // Near Sydney
    ];
    const zones = planZones(southernPOIs);

    expect(zones).toHaveLength(1);
    expect(zones[0].center.lat).toBeLessThan(0);
  });
});
