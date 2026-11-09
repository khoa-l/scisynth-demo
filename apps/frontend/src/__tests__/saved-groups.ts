import type { SavedGroupPublic } from "../client";

export const SAVED_GROUP: SavedGroupPublic = {
  id: "Hk3vQ0aS9mXbT2cLp7eRd",
  name: "Smoothed noise",
  created_at: "2026-11-08T00:00:00Z",
  content: {
    version: 1,
    nodes: [
      {
        id: "noise",
        kind: "GaussianNoise",
        params: {},
        name: null,
        position: { x: 0, y: 0 },
        preview_hidden: false,
      },
      {
        id: "gain",
        kind: "Gain",
        params: {},
        name: null,
        position: { x: 300, y: 0 },
        preview_hidden: false,
      },
    ],
    edges: [
      {
        id: "inside",
        source: "noise",
        source_port: "observation",
        target: "gain",
        target_port: "observation",
      },
    ],
    groups: [
      {
        id: "saved",
        name: "Smoothed noise",
        position: { x: 0, y: 0 },
        width: 556,
        height: 200,
        nodes: ["noise", "gain"],
        inputs: [{ node: "noise", port: "observation" }],
        outputs: [{ node: "gain", port: "observation" }],
        input_position: null,
        output_position: null,
      },
    ],
  },
};
