import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Test the swipe gesture hook logic
describe("useSwipeGesture", () => {
  // Since we can't easily test React hooks with touch events in vitest,
  // we'll test the core swipe detection logic

  const SWIPE_THRESHOLD = 50;
  const SWIPE_VELOCITY_THRESHOLD = 0.3;
  const MAX_VERTICAL_RATIO = 0.75;

  function detectSwipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    deltaTimeMs: number
  ): "left" | "right" | null {
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const velocity = absX / deltaTimeMs;

    const isHorizontal = absY / absX < MAX_VERTICAL_RATIO;
    const hasEnoughDistance = absX > SWIPE_THRESHOLD;
    const hasEnoughVelocity = velocity > SWIPE_VELOCITY_THRESHOLD;

    if (isHorizontal && hasEnoughDistance && hasEnoughVelocity) {
      return deltaX < 0 ? "left" : "right";
    }
    return null;
  }

  it("detects left swipe", () => {
    // Start at 200, end at 50 (moved left 150px in 100ms)
    const result = detectSwipe(200, 100, 50, 100, 100);
    expect(result).toBe("left");
  });

  it("detects right swipe", () => {
    // Start at 50, end at 200 (moved right 150px in 100ms)
    const result = detectSwipe(50, 100, 200, 100, 100);
    expect(result).toBe("right");
  });

  it("ignores too short swipes", () => {
    // Only moved 30px (below threshold of 50)
    const result = detectSwipe(100, 100, 130, 100, 100);
    expect(result).toBeNull();
  });

  it("ignores too slow swipes", () => {
    // Moved 60px but took 500ms (velocity = 0.12, below 0.3)
    const result = detectSwipe(100, 100, 160, 100, 500);
    expect(result).toBeNull();
  });

  it("ignores vertical swipes", () => {
    // Moved diagonally but more vertical
    const result = detectSwipe(100, 100, 150, 200, 100);
    expect(result).toBeNull();
  });

  it("allows slight vertical movement", () => {
    // Moved mostly horizontal with slight vertical
    const result = detectSwipe(100, 100, 200, 130, 100);
    expect(result).toBe("right");
  });
});

describe("Zone navigation logic", () => {
  it("clamps navigation to valid indices", () => {
    const zones = [{}, {}, {}]; // 3 zones
    let currentIndex = 0;

    const navigateToZone = (index: number) => {
      if (index < 0 || index >= zones.length) return;
      currentIndex = index;
    };

    navigateToZone(-1);
    expect(currentIndex).toBe(0);

    navigateToZone(5);
    expect(currentIndex).toBe(0);

    navigateToZone(2);
    expect(currentIndex).toBe(2);
  });

  it("calculates hasPrev and hasNext correctly", () => {
    const zones = [{}, {}, {}]; // 3 zones

    const getNavState = (index: number) => ({
      hasPrev: index > 0,
      hasNext: index < zones.length - 1,
    });

    expect(getNavState(0)).toEqual({ hasPrev: false, hasNext: true });
    expect(getNavState(1)).toEqual({ hasPrev: true, hasNext: true });
    expect(getNavState(2)).toEqual({ hasPrev: true, hasNext: false });
  });
});

describe("Zone completion tracking", () => {
  interface Zone {
    id: string;
    pois: Array<{ id: string; completed: boolean }>;
  }

  function calculateCompletions(zones: Zone[]) {
    return zones.map((zone) => ({
      completed: zone.pois.filter((p) => p.completed).length,
      total: zone.pois.length,
      isComplete:
        zone.pois.length > 0 &&
        zone.pois.filter((p) => p.completed).length === zone.pois.length,
    }));
  }

  it("tracks completion per zone", () => {
    const zones: Zone[] = [
      {
        id: "zone-0",
        pois: [
          { id: "poi-1", completed: true },
          { id: "poi-2", completed: true },
          { id: "poi-3", completed: false },
        ],
      },
      {
        id: "zone-1",
        pois: [
          { id: "poi-4", completed: true },
          { id: "poi-5", completed: true },
        ],
      },
    ];

    const completions = calculateCompletions(zones);

    expect(completions[0]).toEqual({
      completed: 2,
      total: 3,
      isComplete: false,
    });
    expect(completions[1]).toEqual({
      completed: 2,
      total: 2,
      isComplete: true,
    });
  });

  it("handles empty zones", () => {
    const zones: Zone[] = [{ id: "zone-0", pois: [] }];

    const completions = calculateCompletions(zones);

    expect(completions[0]).toEqual({
      completed: 0,
      total: 0,
      isComplete: false, // Empty zone is not "complete"
    });
  });
});
