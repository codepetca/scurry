import { describe, it, expect } from "vitest";
import { getTeamColor, TEAM_COLORS } from "../../src/lib/teamColors";

describe("getTeamColor", () => {
  it("returns green for team index 0", () => {
    const color = getTeamColor(0);
    expect(color.name).toBe("Green");
    expect(color.bg).toBe("#22c55e");
  });

  it("returns blue for team index 1", () => {
    const color = getTeamColor(1);
    expect(color.name).toBe("Blue");
  });

  it("cycles through colors for indices beyond array length", () => {
    const color5 = getTeamColor(5);
    const color0 = getTeamColor(0);
    expect(color5).toEqual(color0); // 5 % 5 = 0
  });

  it("handles large team indices", () => {
    const color = getTeamColor(100);
    expect(color).toEqual(TEAM_COLORS[100 % TEAM_COLORS.length]);
  });

  it("returns objects with bg, ring, and text properties", () => {
    const color = getTeamColor(0);
    expect(color).toHaveProperty("bg");
    expect(color).toHaveProperty("ring");
    expect(color).toHaveProperty("text");
  });
});

describe("TEAM_COLORS", () => {
  it("has exactly 5 colors", () => {
    expect(TEAM_COLORS).toHaveLength(5);
  });

  it("has unique colors", () => {
    const bgColors = TEAM_COLORS.map((c) => c.bg);
    const uniqueBgColors = new Set(bgColors);
    expect(uniqueBgColors.size).toBe(TEAM_COLORS.length);
  });
});
