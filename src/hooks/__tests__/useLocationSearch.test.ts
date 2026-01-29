import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocationSearch } from "../useLocationSearch";
import * as geocoding from "@/../lib/mapkitSearch";

// Mock the geocoding module
vi.mock("@/../lib/mapkitSearch", () => ({
  searchLocations: vi.fn(),
}));

describe("useLocationSearch", () => {
  const mockSearchLocations = geocoding.searchLocations as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSearchLocations.mockReset();
    mockSearchLocations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to flush promises and timers
  async function flushPromises() {
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }

  it("initializes with empty state", () => {
    const { result } = renderHook(() => useLocationSearch());

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("updates query immediately", () => {
    const { result } = renderHook(() => useLocationSearch());

    act(() => {
      result.current.setQuery("Toronto");
    });

    expect(result.current.query).toBe("Toronto");
  });

  it("debounces search calls", async () => {
    const { result } = renderHook(() => useLocationSearch({ debounceMs: 300 }));

    act(() => {
      result.current.setQuery("Tor");
    });

    // Should not call API immediately
    expect(mockSearchLocations).not.toHaveBeenCalled();

    // Advance time past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchLocations).toHaveBeenCalledTimes(1);
    expect(mockSearchLocations).toHaveBeenCalledWith("Tor", {
      limit: 5,
      proximity: undefined,
    });
  });

  it("does not search for empty query", async () => {
    const { result } = renderHook(() => useLocationSearch());

    act(() => {
      result.current.setQuery("");
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchLocations).not.toHaveBeenCalled();
  });

  it("does not search for whitespace-only query", async () => {
    const { result } = renderHook(() => useLocationSearch());

    act(() => {
      result.current.setQuery("   ");
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSearchLocations).not.toHaveBeenCalled();
  });

  it("sets loading state during search", async () => {
    let resolveSearch: (value: geocoding.GeocodingResult[]) => void;
    mockSearchLocations.mockImplementation(
      () => new Promise((resolve) => { resolveSearch = resolve; })
    );

    const { result } = renderHook(() => useLocationSearch({ debounceMs: 0 }));

    act(() => {
      result.current.setQuery("Toronto");
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSearch!([]);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("returns search results", async () => {
    const mockResults: geocoding.GeocodingResult[] = [
      { id: "1", name: "Toronto", fullAddress: "Toronto, ON, Canada", lat: 43.65, lng: -79.38 },
    ];
    mockSearchLocations.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useLocationSearch({ debounceMs: 0 }));

    act(() => {
      result.current.setQuery("Toronto");
    });

    await flushPromises();

    expect(result.current.results).toEqual(mockResults);
  });

  it("handles search errors", async () => {
    mockSearchLocations.mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() => useLocationSearch({ debounceMs: 0 }));

    act(() => {
      result.current.setQuery("Toronto");
    });

    await flushPromises();

    expect(result.current.error).toBe("API Error");
    expect(result.current.results).toEqual([]);
  });

  it("clears results and query with clearResults", async () => {
    const mockResults: geocoding.GeocodingResult[] = [
      { id: "1", name: "Toronto", fullAddress: "Toronto, ON, Canada", lat: 43.65, lng: -79.38 },
    ];
    mockSearchLocations.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useLocationSearch({ debounceMs: 0 }));

    act(() => {
      result.current.setQuery("Toronto");
    });

    await flushPromises();

    expect(result.current.results).toHaveLength(1);

    act(() => {
      result.current.clearResults();
    });

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
  });

  it("passes limit option to searchLocations", async () => {
    const { result } = renderHook(() => useLocationSearch({ debounceMs: 0, limit: 10 }));

    act(() => {
      result.current.setQuery("Toronto");
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(mockSearchLocations).toHaveBeenCalledWith("Toronto", {
      limit: 10,
      proximity: undefined,
    });
  });

  it("passes proximity option to searchLocations", async () => {
    const proximity = { lat: 43.65, lng: -79.38 };
    const { result } = renderHook(() => useLocationSearch({ debounceMs: 0, proximity }));

    act(() => {
      result.current.setQuery("coffee");
    });

    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    expect(mockSearchLocations).toHaveBeenCalledWith("coffee", {
      limit: 5,
      proximity,
    });
  });

  it("cancels pending search on rapid input", async () => {
    const { result } = renderHook(() => useLocationSearch({ debounceMs: 300 }));

    act(() => {
      result.current.setQuery("T");
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current.setQuery("To");
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      result.current.setQuery("Tor");
    });

    // Only after full debounce from last change
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Should only search once with final query
    expect(mockSearchLocations).toHaveBeenCalledTimes(1);
    expect(mockSearchLocations).toHaveBeenCalledWith("Tor", expect.any(Object));
  });
});
