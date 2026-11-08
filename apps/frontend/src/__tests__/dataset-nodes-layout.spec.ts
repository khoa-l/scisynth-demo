import { describe, it, expect } from "vite-plus/test";

import type { GraphNode } from "@vue-flow/core";

import { autoLayout } from "../lib/dataset-nodes/layout";

function node(id: string, extra: Partial<GraphNode> = {}) {
  return {
    id,
    type: "dataset-node",
    position: { x: 500, y: 500 },
    dimensions: { width: 256, height: 100 },
    data: { kind: "Gain", params: {}, previewHidden: true },
    ...extra,
  } as GraphNode;
}

function link(source: string, target: string) {
  return { id: `${source}-${target}`, source, target };
}

describe("Auto-layout", () => {
  it("lays connected nodes out in order from left to right", () => {
    const nodes = [node("c"), node("a"), node("b")];

    const laidOut = autoLayout(nodes, [link("a", "b"), link("b", "c")]);

    expect(laidOut.map((node) => [node.id, node.position])).toEqual([
      ["c", { x: 704, y: 0 }],
      ["a", { x: 0, y: 0 }],
      ["b", { x: 352, y: 0 }],
    ]);
  });

  it("leaves room above a node for its preview", () => {
    const shown = node("a", { data: { kind: "Gain", params: {} } });

    expect(autoLayout([shown], [])[0]!.position).toEqual({ x: 0, y: 264 });
  });

  it("moves a group as one block, keeping its nodes where they are inside it", () => {
    const group = node("g", { type: "dataset-group", dimensions: { width: 400, height: 300 } });
    const member = node("m", { parentNode: "g", position: { x: 24, y: 40 } });

    const laidOut = autoLayout([node("outside"), group, member], [link("outside", "m")]);

    expect(laidOut.map((node) => [node.id, node.position])).toEqual([
      ["outside", { x: 0, y: 100 }],
      ["g", { x: 352, y: 0 }],
      ["m", { x: 24, y: 40 }],
    ]);
  });
});
