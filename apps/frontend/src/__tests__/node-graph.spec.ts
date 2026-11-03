import { describe, it, expect } from "vite-plus/test";

import { fromGraph, toGraph, type DatasetGraph } from "../lib/nodes/graph";
import { localCatalog } from "../lib/nodes/local-catalog";

function savedNode(id: string, kind: string, params: DatasetGraph["nodes"][number]["params"]) {
  return { id, kind, params, position: { x: 10, y: 20 } };
}

function savedEdge(
  id: string,
  source: string,
  sourcePort: string,
  target: string,
  targetPort: string,
) {
  return { id, source, source_port: sourcePort, target, target_port: targetPort };
}

const GRAPH: DatasetGraph = {
  version: 1,
  nodes: [
    savedNode("field", "GaussianField", {
      length_scale: 0.2,
      amplitude: 1,
      mean: 0,
      resolution: 64,
      order: 3,
    }),
    savedNode("sampler", "GridSampler", { shape: 32 }),
    savedNode("quantize", "Quantize", { levels: 16, vmin: null, vmax: 1 }),
  ],
  edges: [
    savedEdge("e1", "field", "field", "sampler", "latent"),
    savedEdge("e2", "sampler", "observation", "quantize", "observation"),
  ],
};

function load(graph: DatasetGraph) {
  return fromGraph(graph, localCatalog);
}

describe("Dataset graph", () => {
  it("saves nodes and edges without Vue Flow's view state", () => {
    const nodes = [
      {
        id: "a",
        type: "catalog",
        position: { x: 1, y: 2 },
        data: { kind: "Gain", params: { factor: 2 } },
        selected: true,
        dimensions: { width: 256, height: 120 },
      },
    ];
    const edges = [
      {
        id: "e",
        source: "a",
        sourceHandle: "observation",
        target: "b",
        targetHandle: "observation",
        selected: true,
      },
    ];

    expect(toGraph(nodes, edges)).toEqual({
      version: 1,
      nodes: [{ id: "a", kind: "Gain", params: { factor: 2 }, position: { x: 1, y: 2 } }],
      edges: [savedEdge("e", "a", "observation", "b", "observation")],
    });
  });

  it("doesn't share parameter objects between the canvas and the saved graph", () => {
    const params = { factor: 2 };
    const nodes = [{ id: "a", position: { x: 0, y: 0 }, data: { kind: "Gain", params } }];

    const saved = toGraph(nodes, []);
    params.factor = 3;
    expect(saved.nodes[0]!.params).toEqual({ factor: 2 });
  });

  it("loads a saved graph as catalogue nodes and port-to-port edges", () => {
    const { nodes, edges } = load(GRAPH);

    expect(nodes[1]).toEqual({
      id: "sampler",
      type: "catalog",
      position: { x: 10, y: 20 },
      data: { kind: "GridSampler", params: { shape: 32 } },
    });
    expect(edges[0]).toEqual({
      id: "e1",
      source: "field",
      sourceHandle: "field",
      target: "sampler",
      targetHandle: "latent",
    });
  });

  it("saves back exactly what it loaded", () => {
    const { nodes, edges } = load(GRAPH);
    expect(toGraph(nodes, edges)).toEqual(GRAPH);
  });

  it("matches saved parameters to the kind's current ones", () => {
    const { nodes } = load({
      version: 1,
      nodes: [
        savedNode("q", "Quantize", { levels: 1.5, vmin: 0, old: 7 }),
        savedNode("i", "InterpolatedField", { order: 9, mode: "unknown-mode" }),
      ],
      edges: [],
    });

    expect(nodes.map((node) => node.data.params)).toEqual([
      { levels: 256, vmin: 0, vmax: null },
      { order: 1, mode: "nearest" },
    ]);
  });

  it("keeps a node whose kind no longer exists, with its links", () => {
    const { nodes, edges } = load({
      version: 1,
      nodes: [savedNode("old", "RemovedStage", { strength: 3 }), ...GRAPH.nodes],
      edges: [savedEdge("e", "sampler", "observation", "old", "in"), ...GRAPH.edges],
    });

    expect(nodes[0]!.data).toEqual({ kind: "RemovedStage", params: { strength: 3 } });
    expect(edges.map((edge) => edge.id)).toEqual(["e", "e1", "e2"]);
  });

  it("drops links between known nodes whose ports no longer fit", () => {
    const { edges } = load({
      ...GRAPH,
      edges: [
        savedEdge("gone", "sampler", "samples", "quantize", "observation"),
        savedEdge("mismatch", "field", "field", "quantize", "observation"),
        ...GRAPH.edges,
      ],
    });

    expect(edges.map((edge) => edge.id)).toEqual(["e1", "e2"]);
  });
});
