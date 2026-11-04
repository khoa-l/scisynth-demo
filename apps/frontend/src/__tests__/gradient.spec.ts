import { describe, it, expect } from "vite-plus/test";

import { itemGradient, itemTextColor } from "../lib/gradient";

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

describe("itemGradient", () => {
  it("returns the same gradient for the same id", () => {
    expect(itemGradient(IDS[0]!)).toBe(itemGradient(IDS[0]!));
  });

  it("returns different gradients for different ids", () => {
    expect(new Set(IDS.map(itemGradient)).size).toBe(IDS.length);
  });
});

describe("itemTextColor", () => {
  it("returns different colors for different ids", () => {
    expect(new Set(IDS.map(itemTextColor)).size).toBe(IDS.length);
  });
});
