import { describe, it, expect } from "vite-plus/test";

import { isValidParam } from "../lib/dataset-nodes/params";
import type { IntegerParam, NumberParam, ParamDef } from "../lib/dataset-nodes/types";

const probability: NumberParam = { type: "number", label: "P", default: 0.1, min: 0, max: 1 };
const bound: NumberParam = { type: "number", label: "Min", default: null, optional: true };
const levels: IntegerParam = { type: "integer", label: "Levels", default: 256, min: 2 };
const mode: ParamDef = {
  type: "enum",
  label: "Mode",
  default: "nearest",
  options: [
    { value: "nearest", label: "Nearest" },
    { value: "grid-wrap", label: "Periodic" },
  ],
};

describe("Node parameters", () => {
  it("accepts numbers in range, and whole numbers for integers", () => {
    expect([0, 0.5, 1].every((v) => isValidParam(probability, v))).toBe(true);
    expect([-0.1, 1.1, Infinity, NaN, "0.5"].some((v) => isValidParam(probability, v))).toBe(false);
    expect(isValidParam(levels, 2)).toBe(true);
    expect(isValidParam(levels, 2.5)).toBe(false);
    expect(isValidParam(levels, 1)).toBe(false);
  });

  it("accepts blank only for optional parameters", () => {
    expect(isValidParam(bound, null)).toBe(true);
    expect(isValidParam(probability, null)).toBe(false);
    expect(isValidParam(probability, undefined)).toBe(false);
  });

  it("accepts only an enum's own options", () => {
    expect(isValidParam(mode, "grid-wrap")).toBe(true);
    expect(isValidParam(mode, "wrap")).toBe(false);
    expect(isValidParam(mode, 1)).toBe(false);
  });
});
