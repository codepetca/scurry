import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchLocations } from "../geocoding";

describe("searchLocations", () => {
  const originalEnv = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = "test-api-key";
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_MAPTILER_API_KEY = originalEnv;
  });

  it("returns empty array for empty query", async () => {
    const results = await searchLocations("");
    expect(results).toEqual([]);
  });

  it("returns empty array for whitespace-only query", async () => {
    const results = await searchLocations("   ");
    expect(results).toEqual([]);
  });

  it("returns empty array when API key is not set", async () => {
    delete process.env.NEXT_PUBLIC_MAPTILER_API_KEY;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await searchLocations("test");

    expect(results).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith("NEXT_PUBLIC_MAPTILER_API_KEY is not set");
    consoleSpy.mockRestore();
  });

  it("calls MapTiler API with correct URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchLocations("Toronto");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("https://api.maptiler.com/geocoding/Toronto.json");
    expect(url).toContain("key=test-api-key");
    expect(url).toContain("limit=5");

    vi.unstubAllGlobals();
  });

  it("includes proximity parameter when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchLocations("coffee", { proximity: { lat: 43.65, lng: -79.38 } });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("proximity=-79.38%2C43.65");

    vi.unstubAllGlobals();
  });

  it("transforms MapTiler response to GeocodingResult format", async () => {
    const mockResponse = {
      features: [
        {
          id: "place.123",
          text: "Toronto",
          place_name: "Toronto, Ontario, Canada",
          center: [-79.3832, 43.6532],
        },
        {
          id: "place.456",
          text: "Toronto Pearson Airport",
          place_name: "Toronto Pearson International Airport, Mississauga, Ontario, Canada",
          center: [-79.6306, 43.6777],
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await searchLocations("Toronto");

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: "place.123",
      name: "Toronto",
      fullAddress: "Toronto, Ontario, Canada",
      lat: 43.6532,
      lng: -79.3832,
    });
    expect(results[1]).toEqual({
      id: "place.456",
      name: "Toronto Pearson Airport",
      fullAddress: "Toronto Pearson International Airport, Mississauga, Ontario, Canada",
      lat: 43.6777,
      lng: -79.6306,
    });

    vi.unstubAllGlobals();
  });

  it("returns empty array on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", mockFetch);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await searchLocations("Toronto");

    expect(results).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
    consoleSpy.mockRestore();
  });

  it("returns empty array on network error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await searchLocations("Toronto");

    expect(results).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();

    vi.unstubAllGlobals();
    consoleSpy.mockRestore();
  });

  it("respects custom limit option", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchLocations("Toronto", { limit: 10 });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("limit=10");

    vi.unstubAllGlobals();
  });

  it("encodes special characters in query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ features: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchLocations("123 Main St & Oak Ave");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("123%20Main%20St%20%26%20Oak%20Ave");

    vi.unstubAllGlobals();
  });
});
