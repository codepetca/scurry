import { describe, it, expect } from "vitest";
import { Z_INDEX } from "../../src/lib/zIndex";

describe("Z_INDEX", () => {
  it("has MAP_CONTROLS at base layer", () => {
    expect(Z_INDEX.MAP_CONTROLS).toBe(10);
  });

  it("has MODAL_BACKDROP higher than MAP_CONTROLS", () => {
    expect(Z_INDEX.MODAL_BACKDROP).toBeGreaterThan(Z_INDEX.MAP_CONTROLS);
  });

  it("has MODAL_CONTENT higher than MODAL_BACKDROP", () => {
    expect(Z_INDEX.MODAL_CONTENT).toBeGreaterThan(Z_INDEX.MODAL_BACKDROP);
  });

  it("has TOAST at highest layer", () => {
    expect(Z_INDEX.TOAST).toBeGreaterThan(Z_INDEX.MODAL_CONTENT);
  });

  it("maintains proper layering order", () => {
    const values = [
      Z_INDEX.MAP_CONTROLS,
      Z_INDEX.MODAL_BACKDROP,
      Z_INDEX.MODAL_CONTENT,
      Z_INDEX.TOAST,
    ];

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});
