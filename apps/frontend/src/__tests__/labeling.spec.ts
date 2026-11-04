import { describe, it, expect } from "vite-plus/test";

import type { NodePreview, TypedArray } from "../client";
import {
  brushed,
  eraseLabels,
  lassoed,
  locations,
  nearest,
  setLabel,
  type PlacedLocation,
} from "../lib/labeling";

function typed(values: number[]): TypedArray {
  const bytes = new Uint8Array(new Float32Array(values).buffer);
  return { dtype: "f4", bdata: btoa(String.fromCharCode(...bytes)), shape: String(values.length) };
}

const row: PlacedLocation[] = [0, 10, 20, 30].map((x, index) => ({ index, at: { x, y: 0 } }));

describe("Labeling", () => {
  it("finds a grid's cells row by row, leaving out the gaps", () => {
    const preview: NodePreview = {
      layout: "grid",
      axes: ["x", "y"],
      x: typed([0, 1, 2]),
      y: typed([5, 6]),
      channels: [typed([1, NaN, 1, 1, 1, NaN]), typed([1, NaN, 1, 1, 1, 1])],
    };

    expect(locations(preview)).toEqual([
      { index: 0, x: 0, y: 5 },
      { index: 2, x: 2, y: 5 },
      { index: 3, x: 0, y: 6 },
      { index: 4, x: 1, y: 6 },
      { index: 5, x: 2, y: 6 },
    ]);
  });

  it("finds points that have a place and a value", () => {
    const preview: NodePreview = {
      layout: "points",
      axes: ["c0", "c1"],
      x: typed([0.5, NaN, 2]),
      y: typed([1, NaN, 3]),
      channels: [typed([7, NaN, NaN])],
    };

    expect(locations(preview)).toEqual([{ index: 0, x: 0.5, y: 1 }]);
  });

  it("picks the nearest point within reach", () => {
    expect(nearest(row, { x: 12, y: 3 }, 8)).toEqual([1]);
    expect(nearest(row, { x: 15, y: 30 }, 8)).toEqual([]);
  });

  it("brushes every point along a stroke", () => {
    expect(brushed(row, { x: 8, y: 2 }, { x: 22, y: 2 }, 3)).toEqual([1, 2]);
    expect(brushed(row, { x: 30, y: 4 }, { x: 30, y: 4 }, 5)).toEqual([3]);
  });

  it("lassoes the points inside an outline", () => {
    const outline = [
      { x: 5, y: -5 },
      { x: 25, y: -5 },
      { x: 25, y: 5 },
      { x: 5, y: 5 },
    ];

    expect(lassoed(row, outline)).toEqual([1, 2]);
  });

  it("labels points, replacing any label they had", () => {
    const labelled = setLabel({ defect: [4, 1] }, "clean", [4]);
    expect(labelled).toEqual({ defect: [1], clean: [4] });

    expect(setLabel(labelled, "defect", [2, 4])).toEqual({ defect: [1, 2, 4] });
  });

  it("erases every label from points, dropping labels left empty", () => {
    expect(eraseLabels({ defect: [1, 2], clean: [2] }, [2])).toEqual({ defect: [1] });
  });
});
