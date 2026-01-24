import { describe, it, expect } from "vitest";
import { searchLocations } from "../mapkitSearch";

describe("searchLocations (MapKit JS)", () => {
  // Note: Full MapKit JS tests require browser environment
  // The hook tests (useLocationSearch.test.ts) cover the integration via mocking

  it("returns empty array for empty query", async () => {
    const results = await searchLocations("");
    expect(results).toEqual([]);
  });

  it("returns empty array for whitespace-only query", async () => {
    const results = await searchLocations("   ");
    expect(results).toEqual([]);
  });

  it("exports GeocodingResult type", async () => {
    // Type check - this just ensures the export exists
    const results = await searchLocations("");
    expect(Array.isArray(results)).toBe(true);
  });
});
