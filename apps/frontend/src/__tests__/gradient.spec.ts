import { describe, it, expect } from "vite-plus/test";

import { projectGradient, projectTextColor } from "../lib/gradient";

describe("projectGradient", () => {
  it("returns the same gradient for the same project", () => {
    expect(projectGradient(7)).toBe(projectGradient(7));
  });

  it("returns different gradients for consecutive projects", () => {
    const gradients = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(projectGradient));
    expect(gradients.size).toBe(8);
  });

  it("builds a two-stop oklch linear gradient", () => {
    expect(projectGradient(1)).toMatch(
      /^linear-gradient\(135deg, oklch\(0\.85 0\.12 [\d.]+\), oklch\(0\.7 0\.15 [\d.]+\)\)$/,
    );
  });
});

describe("projectTextColor", () => {
  it("is a light solid colour between the gradient's two hues", () => {
    const hue = (3 * 137.508) % 360;
    expect(projectTextColor(3)).toBe(`oklch(0.95 0.06 ${(hue + 30) % 360})`);
  });

  it("returns different colours for consecutive projects", () => {
    const colours = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(projectTextColor));
    expect(colours.size).toBe(8);
  });
});
