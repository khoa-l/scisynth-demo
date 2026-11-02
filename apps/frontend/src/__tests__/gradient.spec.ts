import { describe, it, expect } from "vite-plus/test";

import { projectGradient } from "../lib/gradient";

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
