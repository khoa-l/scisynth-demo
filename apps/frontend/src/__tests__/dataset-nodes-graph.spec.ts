import { describe, it, expect } from "vite-plus/test";

import type { GraphNode } from "@vue-flow/core";

import {
  fromGraph,
  nodePreviewRequest,
  toGraph,
  type DatasetGraph,
} from "../lib/dataset-nodes/graph";
import {
  groupNodes,
  memberConnection,
  memberPorts,
  setGroupCollapsed,
  ungroupNodes,
  withCollapsedEdges,
} from "../lib/dataset-nodes/groups";
import { localCatalog } from "../lib/dataset-nodes/local-catalog";

function savedNode(id: string, kind: string, params: DatasetGraph["nodes"][number]["params"]) {
  return { id, kind, params, position: { x: 10, y: 20 }, preview_hidden: false };
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
      seed: 7,
    }),
    savedNode("sampler", "GridSampler", { shape: 32 }),
    savedNode("quantize", "Quantize", { levels: 16, vmin: null, vmax: 1 }),
  ],
  edges: [
    savedEdge("e1", "field", "field", "sampler", "latent"),
    savedEdge("e2", "sampler", "observation", "quantize", "observation"),
  ],
  groups: [],
};

function load(graph: DatasetGraph) {
  return fromGraph(graph, localCatalog);
}

describe("Dataset graph", () => {
  it("saves nodes and edges without Vue Flow's view state", () => {
    const nodes = [
      {
        id: "a",
        type: "dataset-node",
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
      nodes: [
        {
          id: "a",
          kind: "Gain",
          params: { factor: 2 },
          position: { x: 1, y: 2 },
          preview_hidden: false,
        },
      ],
      edges: [savedEdge("e", "a", "observation", "b", "observation")],
      groups: [],
    });
  });

  it("loads a saved graph as dataset nodes and port-to-port edges", () => {
    const { nodes, edges } = load(GRAPH);

    expect(nodes[1]).toEqual({
      id: "sampler",
      type: "dataset-node",
      position: { x: 10, y: 20 },
      data: { kind: "GridSampler", params: { shape: 32 }, previewHidden: false },
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

  it("remembers which nodes have their preview hidden", () => {
    const hidden = { ...GRAPH, nodes: [{ ...GRAPH.nodes[0]!, preview_hidden: true }] };
    const { nodes, edges } = load({ ...hidden, edges: [] });

    expect(nodes[0]!.data.previewHidden).toBe(true);
    expect(toGraph(nodes, edges).nodes[0]!.preview_hidden).toBe(true);
  });

  it("matches saved parameters to the kind's current ones", () => {
    const { nodes } = load({
      version: 1,
      nodes: [
        savedNode("q", "Quantize", { levels: 1.5, vmin: 0, old: 7 }),
        savedNode("i", "InterpolatedField", { order: 9, mode: "unknown-mode" }),
        savedNode("p", "PCA", { whiten: 1, svd_solver: "full" }),
        savedNode("w", "PCA", { whiten: true, seed: true }),
      ],
      edges: [],
      groups: [],
    });

    expect(nodes.map((node) => node.data.params)).toEqual([
      { levels: 256, vmin: 0, vmax: null },
      { order: 1, mode: "nearest" },
      { whiten: false, svd_solver: "full", seed: 0 },
      { whiten: true, svd_solver: "auto", seed: 0 },
    ]);
  });

  it("keeps a node whose kind no longer exists, with its links", () => {
    const { nodes, edges } = load({
      version: 1,
      nodes: [savedNode("old", "RemovedStage", { strength: 3 }), ...GRAPH.nodes],
      edges: [savedEdge("e", "sampler", "observation", "old", "in"), ...GRAPH.edges],
      groups: [],
    });

    expect(nodes[0]!.data).toEqual({
      kind: "RemovedStage",
      params: { strength: 3 },
      previewHidden: false,
    });
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

  it("builds a latent preview from the node and everything upstream of it", () => {
    const graph: DatasetGraph = {
      version: 1,
      nodes: [
        savedNode("a", "GaussianField", { seed: 1 }),
        savedNode("b", "GaussianField", { seed: 2 }),
        savedNode("sum", "Sum", {}),
        savedNode("sampler", "GridSampler", { shape: 32 }),
        savedNode("other", "GaussianField", { seed: 3 }),
      ],
      edges: [
        savedEdge("e1", "a", "field", "sum", "terms"),
        savedEdge("e2", "b", "field", "sum", "terms"),
        savedEdge("e3", "sum", "field", "sampler", "latent"),
      ],
      groups: [],
    };

    expect(nodePreviewRequest(graph, "sum")).toEqual({
      node: "sum",
      nodes: [
        { id: "a", kind: "GaussianField", params: { seed: 1 } },
        { id: "b", kind: "GaussianField", params: { seed: 2 } },
        { id: "sum", kind: "Sum", params: {} },
      ],
      edges: [graph.edges[0], graph.edges[1]],
    });
    expect(nodePreviewRequest(graph, "other")).toEqual({
      node: "other",
      nodes: [{ id: "other", kind: "GaussianField", params: { seed: 3 } }],
      edges: [],
    });
  });

  describe("groups", () => {
    const GROUPED: DatasetGraph = {
      ...GRAPH,
      groups: [
        {
          id: "g",
          position: { x: 100, y: 200 },
          width: 400,
          height: 300,
          nodes: ["field", "sampler"],
          collapsed: false,
        },
      ],
    };

    it("loads a group before its nodes, which are kept inside its bounds", () => {
      const { nodes } = load(GROUPED);

      expect(nodes.map((node) => [node.id, node.parentNode, node.extent])).toEqual([
        ["g", undefined, undefined],
        [
          "field",
          "g",
          [
            [0, 0],
            [400, 300],
          ],
        ],
        [
          "sampler",
          "g",
          [
            [0, 0],
            [400, 300],
          ],
        ],
        ["quantize", undefined, undefined],
      ]);
      expect(nodes[0]).toMatchObject({
        type: "dataset-group",
        position: { x: 100, y: 200 },
        width: 400,
        height: 300,
      });
    });

    it("saves back exactly the groups it loaded", () => {
      const { nodes, edges } = load(GROUPED);
      expect(toGraph(nodes, edges)).toEqual(GROUPED);
    });

    it("loads a collapsed group with its nodes hidden, and saves it collapsed", () => {
      const collapsed = { ...GROUPED, groups: [{ ...GROUPED.groups[0]!, collapsed: true }] };
      const { nodes, edges } = load(collapsed);

      expect(nodes.map((node) => [node.id, node.hidden])).toEqual([
        ["g", undefined],
        ["field", true],
        ["sampler", true],
        ["quantize", undefined],
      ]);
      expect(nodes[0]!.style).toEqual({ width: "auto", height: "auto" });
      expect(edges.map((edge) => [edge.source, edge.sourceHandle, edge.target])).toEqual([
        ["field", "field", "sampler"],
        ["sampler", "observation", "quantize"],
        ["g", "sampler.observation", "quantize"],
      ]);
      expect(toGraph(nodes, edges)).toEqual(collapsed);
    });

    it("collapses a group into one node and expands it again", () => {
      const { nodes } = load(GROUPED);

      const collapsed = setGroupCollapsed(nodes as GraphNode[], "g", true);
      expect(collapsed.map((node) => [node.id, node.hidden])).toEqual([
        ["g", undefined],
        ["field", true],
        ["sampler", true],
        ["quantize", undefined],
      ]);
      expect(collapsed[0]).toMatchObject({
        data: { collapsed: true },
        style: { width: "auto", height: "auto" },
        width: 400,
        height: 300,
      });

      const expanded = setGroupCollapsed(collapsed as GraphNode[], "g", false);
      expect(expanded.map((node) => node.hidden)).toEqual([undefined, false, false, undefined]);
      expect(expanded[0]).toMatchObject({ data: { collapsed: false }, style: undefined });
    });

    it("doesn't save a group with no nodes left in it", () => {
      const { nodes, edges } = load(GROUPED);
      const ungrouped = nodes.map((node) => ({ ...node, parentNode: undefined }));
      expect(toGraph(ungrouped, edges).groups).toEqual([]);
    });

    function placed(id: string, x: number, y: number, parentNode?: string) {
      return {
        id,
        type: "dataset-node",
        position: { x, y },
        computedPosition: { x, y, z: 0 },
        dimensions: { width: 256, height: 100 },
        data: { kind: "Gain", params: {} },
        parentNode,
      } as GraphNode;
    }

    it("puts the chosen nodes in a new group that fits around them, with room for their toolbars", () => {
      const nodes = [placed("a", 0, 0), placed("b", 300, 200), placed("c", 900, 900)];

      const [group, ...rest] = groupNodes(nodes, ["a", "b"], "g");

      expect(group).toMatchObject({
        id: "g",
        type: "dataset-group",
        position: { x: -24, y: -40 },
        width: 608,
        height: 404,
      });
      expect(rest.map((node) => [node.id, node.parentNode, node.extent, node.position])).toEqual([
        [
          "a",
          "g",
          [
            [0, 0],
            [608, 404],
          ],
          { x: 24, y: 40 },
        ],
        [
          "b",
          "g",
          [
            [0, 0],
            [608, 404],
          ],
          { x: 324, y: 240 },
        ],
        ["c", undefined, undefined, { x: 900, y: 900 }],
      ]);
    });

    it("leaves room to spread bunched-up nodes out in a grid", () => {
      const nodes = [placed("a", 0, 0), placed("b", 0, 0), placed("c", 0, 0)];

      const [group] = groupNodes(nodes, ["a", "b", "c"], "g");

      expect(group).toMatchObject({ width: 608, height: 392 });
    });

    it("ungroups by removing the group and leaving its nodes where they were", () => {
      const group = { ...placed("g", 100, 100), type: "dataset-group" } as GraphNode;
      const other = { ...placed("h", 0, 0), type: "dataset-group" } as GraphNode;
      const nodes = [
        group,
        other,
        {
          ...placed("a", 130, 150, "g"),
          position: { x: 30, y: 50 },
          extent: [
            [0, 0],
            [300, 200],
          ],
          hidden: true,
        },
        {
          ...placed("b", 10, 10, "h"),
          extent: [
            [0, 0],
            [300, 200],
          ],
        },
      ] as GraphNode[];

      const ungrouped = ungroupNodes(nodes, "g");

      expect(ungrouped.find((node) => node.id === "a")!.hidden).toBe(false);
      expect(
        ungrouped.map((node) => [node.id, node.parentNode, node.extent, node.position]),
      ).toEqual([
        ["h", undefined, undefined, { x: 0, y: 0 }],
        ["a", undefined, undefined, { x: 130, y: 150 }],
        [
          "b",
          "h",
          [
            [0, 0],
            [300, 200],
          ],
          { x: 10, y: 10 },
        ],
      ]);
    });

    describe("connections of a collapsed group", () => {
      const member = (id: string, parentNode: string) => ({
        id,
        position: { x: 0, y: 0 },
        parentNode,
      });
      const groupOf = (id: string, collapsed: boolean) => ({
        id,
        type: "dataset-group",
        position: { x: 0, y: 0 },
        data: { collapsed },
      });
      const link = (id: string, source: string, target: string) => ({
        id,
        source,
        sourceHandle: "out",
        target,
        targetHandle: "in",
      });
      const nodes = [
        groupOf("g", true),
        groupOf("h", true),
        groupOf("open", false),
        member("a", "g"),
        member("b", "g"),
        member("c", "h"),
        member("d", "open"),
        { id: "outside", position: { x: 0, y: 0 } },
      ];

      function shown(edges: ReturnType<typeof withCollapsedEdges>) {
        return edges
          .filter((edge) => edge.data?.standsFor)
          .map((edge) => [
            edge.data.standsFor,
            `${edge.source}.${edge.sourceHandle}`,
            `${edge.target}.${edge.targetHandle}`,
          ]);
      }

      it("draws connections in and out of the group to the group's port for them", () => {
        const edges = [
          link("in", "outside", "a"),
          link("out", "b", "outside"),
          link("inside", "a", "b"),
          link("between", "a", "c"),
          link("open", "d", "outside"),
        ];

        expect(shown(withCollapsedEdges(nodes, edges))).toEqual([
          ["in", "outside.out", "g.a.in"],
          ["out", "g.b.out", "outside.in"],
          ["between", "g.a.out", "h.c.in"],
        ]);
      });

      it("replaces the lines it drew before, keeping the real connections", () => {
        const edges = [link("in", "outside", "a")];
        const once = withCollapsedEdges(nodes, edges);
        const expanded = nodes.map((node) =>
          node.id === "g" ? { ...node, data: { collapsed: false } } : node,
        );

        expect(withCollapsedEdges(nodes, once)).toEqual(once);
        expect(withCollapsedEdges(expanded, once)).toEqual(edges);
      });
    });

    describe("ports of a collapsed group", () => {
      function ports(graph: DatasetGraph) {
        const { nodes, edges } = load(graph);
        return memberPorts(nodes, edges, localCatalog, "g");
      }

      it("has the inputs and outputs that aren't joined up inside the group", () => {
        expect(ports(GROUPED)).toMatchObject([
          {
            id: "sampler",
            label: "Grid sampler",
            inputs: [],
            outputs: [{ id: "sampler.observation", label: "Observation" }],
          },
        ]);
      });

      it("keeps an input that is also fed from outside the group", () => {
        const graph: DatasetGraph = {
          version: 1,
          nodes: [
            savedNode("a", "GaussianField", {}),
            savedNode("b", "GaussianField", {}),
            savedNode("sum", "Sum", {}),
          ],
          edges: [
            savedEdge("e1", "a", "field", "sum", "terms"),
            savedEdge("e2", "b", "field", "sum", "terms"),
          ],
          groups: [
            {
              id: "g",
              position: { x: 0, y: 0 },
              width: 100,
              height: 100,
              nodes: ["a", "sum"],
              collapsed: true,
            },
          ],
        };

        expect(ports(graph)).toMatchObject([
          {
            id: "sum",
            label: "Sum",
            inputs: [{ id: "sum.terms", label: "Terms", multiple: true }],
            outputs: [{ id: "sum.field", label: "Field" }],
          },
        ]);
      });
    });

    it("turns a connection to a collapsed group's port into one to the node behind it", () => {
      const { nodes } = load(GROUPED);

      expect(
        memberConnection(
          {
            source: "g",
            sourceHandle: "sampler.observation",
            target: "quantize",
            targetHandle: "observation",
          },
          nodes,
        ),
      ).toEqual({
        source: "sampler",
        sourceHandle: "observation",
        target: "quantize",
        targetHandle: "observation",
      });
      expect(
        memberConnection(
          {
            source: "quantize",
            sourceHandle: "observation",
            target: "g",
            targetHandle: "field.in",
          },
          nodes,
        ),
      ).toEqual({
        source: "quantize",
        sourceHandle: "observation",
        target: "field",
        targetHandle: "in",
      });
    });
  });
});
