import { describe, it, expect } from "vite-plus/test";

import { projectGradient, projectTextColor } from "../lib/gradient";

const IDS = [
  "ZaJP8xZrS0lu5xo_xiDLU",
  "-A_IcoOXVsqsnfNVIW2vU",
  "Ee0UBs_wffUI409HkGhlE",
  "1fVyIrST9GgR9DbuTv2_9",
  "nRjRBwQDhpf1gzRRSMyMX",
  "D5SJPkQmpy-cVXXwZFHBx",
  "7IyWdgoFfxTnl_MHpnlYI",
  "Eq-OvCTLPC6Urz_TXE8eJ",
];

function hues(color: string): number[] {
  return [...color.matchAll(/oklch\([\d.]+ [\d.]+ ([\d.]+)\)/g)].map((match) => Number(match[1]));
}

describe("projectGradient", () => {
  it("returns the same gradient for the same id", () => {
    expect(projectGradient(IDS[0]!)).toBe(projectGradient(IDS[0]!));
  });

  it("returns different gradients for different ids", () => {
    expect(new Set(IDS.map(projectGradient)).size).toBe(IDS.length);
  });

  it("builds a two-stop oklch linear gradient", () => {
    expect(projectGradient(IDS[0]!)).toMatch(
      /^linear-gradient\(135deg, oklch\(0\.85 0\.12 [\d.]+\), oklch\(0\.7 0\.15 [\d.]+\)\)$/,
    );
  });
});

describe("projectTextColor", () => {
  it("is a light solid colour between the gradient's two hues", () => {
    for (const id of IDS) {
      const [start] = hues(projectGradient(id));
      expect(projectTextColor(id)).toBe(`oklch(0.95 0.06 ${(start! + 30) % 360})`);
    }
  });

  it("returns different colours for different ids", () => {
    expect(new Set(IDS.map(projectTextColor)).size).toBe(IDS.length);
  });
});
