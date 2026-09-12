import { describe, expect, it } from "vitest";
import { tubeBeads } from "@/components/game/Snake3D";

describe("thin 3D snake tube", () => {
  it("packs extra beads between adjacent cells so the body is a tube, not four blobs", () => {
    const beads = tubeBeads([
      { x: 4, y: 7 },
      { x: 4, y: 8 },
      { x: 4, y: 9 },
      { x: 3, y: 9 },
    ]);
    expect(beads[0]).toMatchObject({ x: 4, y: 7, isHead: true });
    expect(beads.length).toBeGreaterThan(4);
    expect(beads.some((bead) => bead.x === 4 && Math.abs(bead.y - (7 + 1 / 3)) < 1e-9)).toBe(true);
    expect(beads.filter((bead) => bead.isHead)).toHaveLength(1);
  });

  it("does not interpolate across a wrap gap", () => {
    const beads = tubeBeads([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ]);
    expect(beads).toHaveLength(2);
  });
});
