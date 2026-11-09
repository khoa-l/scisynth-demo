import { describe, it, expect } from "vite-plus/test";

import type { Edge, GraphNode } from "@vue-flow/core";

import {
  fromGraph,
  nodePreviewRequest,
  toGraph,
  type DatasetGraph,
} from "../lib/dataset-nodes/graph";
import {
  closeGroup,
  copyGroupGraph,
  groupGraph,
  groupNodes,
  memberConnection,
  memberPorts,
  openGroup,
  ungroupNodes,
  withGroupEdges,
} from "../lib/dataset-nodes/groups";
import { localCatalog } from "../lib/dataset-nodes/local-catalog";

function savedNode(id: string, kind: string, params: DatasetGraph["nodes"][number]["params"]) {
  return { id, kind, params, name: null, position: { x: 10, y: 20 }, preview_hidden: false };
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
    const nodes = ["a", "b"].map((id) => ({
      id,
      type: "dataset-node",
      position: { x: 1, y: 2 },
      data: { kind: "Gain", params: { factor: 2 } },
      selected: true,
      dimensions: { width: 256, height: 120 },
    }));
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
      nodes: ["a", "b"].map((id) => ({
        id,
        kind: "Gain",
        params: { factor: 2 },
        name: null,
        position: { x: 1, y: 2 },
        preview_hidden: false,
      })),
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
      data: { kind: "GridSampler", params: { shape: 32 }, name: null, previewHidden: false },
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

  it("saves the names given to nodes and groups", () => {
    const named: DatasetGraph = {
      ...GRAPH,
      nodes: [{ ...GRAPH.nodes[0]!, name: "Smooth field" }, ...GRAPH.nodes.slice(1)],
      groups: [
        {
          id: "g",
          name: "Sampling",
          position: { x: 0, y: 0 },
          nodes: ["sampler"],
          inputs: [],
          outputs: [],
          input_position: null,
          output_position: null,
        },
      ],
    };

    const { nodes, edges } = load(named);

    expect(nodes.find((node) => node.id === "field")!.data.name).toBe("Smooth field");
    expect(nodes[0]!.data.name).toBe("Sampling");
    expect(toGraph(nodes, edges)).toEqual(named);
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
      name: null,
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
          name: null,
          position: { x: 100, y: 200 },
          nodes: ["field", "sampler"],
          inputs: [],
          outputs: [{ node: "sampler", port: "observation" }],
          input_position: null,
          output_position: null,
        },
      ],
    };

    it("loads a group before its nodes, which are hidden inside it", () => {
      const { nodes, edges } = load(GROUPED);

      expect(nodes.map((node) => [node.id, node.parentNode, node.hidden])).toEqual([
        ["g", undefined, undefined],
        ["field", "g", true],
        ["sampler", "g", true],
        ["quantize", undefined, undefined],
      ]);
      expect(nodes[0]).toMatchObject({
        type: "dataset-group",
        position: { x: 100, y: 200 },
        data: { outputs: [{ node: "sampler", port: "observation" }] },
      });
      expect(edges.map((edge) => [edge.source, edge.sourceHandle, edge.target])).toEqual([
        ["field", "field", "sampler"],
        ["sampler", "observation", "quantize"],
        ["g", "sampler.observation", "quantize"],
      ]);
    });

    it("saves back exactly the groups it loaded, without the lines drawn to them", () => {
      const { nodes, edges } = load(GROUPED);
      expect(toGraph(nodes, edges)).toEqual(GROUPED);
    });

    it("doesn't save a group with no nodes left in it", () => {
      const { nodes, edges } = load(GROUPED);
      const ungrouped = nodes.map((node) => ({ ...node, parentNode: undefined }));
      expect(toGraph(ungrouped, edges).groups).toEqual([]);
    });

    it("saves a group as its own graph, with only the lines inside it", () => {
      expect(groupGraph(GROUPED, "g")).toEqual({
        version: 1,
        nodes: GROUPED.nodes.slice(0, 2),
        edges: [GROUPED.edges[0]],
        groups: [{ ...GROUPED.groups[0], position: { x: 0, y: 0 } }],
      });
    });

    it("copies a saved group with new ids, placed where it is dropped", () => {
      const saved = groupGraph(GROUPED, "g");

      const copy = copyGroupGraph(saved, { x: 5, y: 6 });

      const [group] = copy.groups;
      const [field, sampler] = copy.nodes;
      expect([group!.id, field!.id, sampler!.id, copy.edges[0]!.id]).not.toContain("g");
      expect(new Set([group!.id, field!.id, sampler!.id, copy.edges[0]!.id]).size).toBe(4);
      expect(group).toMatchObject({
        position: { x: 5, y: 6 },
        nodes: [field!.id, sampler!.id],
        outputs: [{ node: sampler!.id, port: "observation" }],
      });
      expect(copy.edges[0]).toMatchObject({ source: field!.id, target: sampler!.id });
      expect(copy.nodes.map(({ kind, params }) => ({ kind, params }))).toEqual(
        saved.nodes.map(({ kind, params }) => ({ kind, params })),
      );
    });

    function placed(id: string, x: number, y: number, parentNode?: string, kind = "Gain") {
      return {
        id,
        type: "dataset-node",
        position: { x, y },
        computedPosition: { x, y, z: 0 },
        dimensions: { width: 256, height: 100 },
        data: { kind, params: {} },
        parentNode,
      } as GraphNode;
    }

    it("puts the chosen nodes in a new group where they were, hiding them inside it", () => {
      const nodes = [placed("a", 0, 0), placed("b", 300, 200), placed("c", 900, 900)];

      const [group, ...rest] = groupNodes(nodes, [], localCatalog, ["a", "b"], "g");

      expect(group).toMatchObject({
        id: "g",
        type: "dataset-group",
        position: { x: 0, y: 0 },
      });
      expect(rest.map((node) => [node.id, node.parentNode, node.hidden, node.position])).toEqual([
        ["a", "g", true, { x: 0, y: 0 }],
        ["b", "g", true, { x: 300, y: 200 }],
        ["c", undefined, undefined, { x: 900, y: 900 }],
      ]);
    });

    it("ungroups by removing the group and putting its nodes back where they were", () => {
      const group = { ...placed("g", 100, 100), type: "dataset-group" } as GraphNode;
      const other = { ...placed("h", 0, 0), type: "dataset-group" } as GraphNode;
      const nodes = [
        group,
        other,
        { ...placed("a", 130, 150, "g"), position: { x: 30, y: 50 }, hidden: true },
        { ...placed("b", 10, 10, "h"), hidden: true },
      ];

      const ungrouped = ungroupNodes(nodes, "g");

      expect(
        ungrouped.map((node) => [node.id, node.parentNode, node.hidden, node.position]),
      ).toEqual([
        ["h", undefined, undefined, { x: 0, y: 0 }],
        ["a", undefined, false, { x: 130, y: 150 }],
        ["b", "h", true, { x: 10, y: 10 }],
      ]);
    });

    describe("connections of a group", () => {
      const member = (id: string, parentNode: string) => ({
        id,
        position: { x: 0, y: 0 },
        parentNode,
      });
      const groupOf = (id: string) => ({ id, type: "dataset-group", position: { x: 0, y: 0 } });
      const link = (id: string, source: string, target: string) => ({
        id,
        source,
        sourceHandle: "out",
        target,
        targetHandle: "in",
      });
      const nodes = [
        groupOf("g"),
        groupOf("h"),
        member("a", "g"),
        member("b", "g"),
        member("c", "h"),
        { id: "outside", position: { x: 0, y: 0 } },
      ];

      function shown(edges: Edge[]) {
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
        ];

        expect(shown(withGroupEdges(nodes, edges))).toEqual([
          ["in", "outside.out", "g.a.in"],
          ["out", "g.b.out", "outside.in"],
          ["between", "g.a.out", "h.c.in"],
        ]);
      });

      it("replaces the lines it drew before, keeping the real connections", () => {
        const edges = [link("in", "outside", "a")];
        const once = withGroupEdges(nodes, edges);
        const ungrouped = nodes.map(({ id, position }) => ({ id, position }));

        expect(withGroupEdges(nodes, once)).toEqual(once);
        expect(withGroupEdges(ungrouped, once)).toEqual(edges);
      });
    });

    it("exposes the ports that aren't only joined up inside the new group", () => {
      const nodes = [
        placed("a", 0, 0, undefined, "GaussianField"),
        placed("b", 0, 200, undefined, "GaussianField"),
        placed("sum", 300, 0, undefined, "Sum"),
      ];
      const edges = [
        { id: "e1", source: "a", sourceHandle: "field", target: "sum", targetHandle: "terms" },
        { id: "e2", source: "b", sourceHandle: "field", target: "sum", targetHandle: "terms" },
      ];

      const [group] = groupNodes(nodes, edges, localCatalog, ["a", "sum"], "g");

      expect(group!.data).toMatchObject({
        inputs: [{ node: "sum", port: "terms" }],
        outputs: [{ node: "sum", port: "field" }],
      });
    });

    it("lists the ports a group exposes under the node they belong to", () => {
      const { nodes } = load(GROUPED);

      expect(memberPorts(nodes, localCatalog, "g")).toMatchObject([
        {
          id: "sampler",
          label: "Grid Sampler",
          inputs: [],
          outputs: [{ id: "observation", handle: "sampler.observation", label: "Observation" }],
        },
      ]);
    });

    it("opens a group by showing only its nodes, joined to a group input and a group output", () => {
      const { nodes, edges } = load(GROUPED);

      const view = openGroup(nodes as GraphNode[], edges, "g");

      expect(
        view.nodes.filter((node) => !node.hidden).map((node) => [node.id, node.position]),
      ).toEqual([
        ["field", { x: 10, y: 20 }],
        ["sampler", { x: 10, y: 20 }],
        ["group-input", { x: -278, y: 20 }],
        ["group-output", { x: 362, y: 20 }],
      ]);
      expect(view.edges.at(-1)).toMatchObject({
        source: "sampler",
        sourceHandle: "observation",
        target: "group-output",
      });
    });

    it("saves where an open group shows its input and output", () => {
      const { nodes, edges } = load(GROUPED);
      const view = openGroup(nodes as GraphNode[], edges, "g");
      const moved = view.nodes.map((node) =>
        node.id === "group-input" ? { ...node, position: { x: -500, y: 70 } } : node,
      );

      expect(toGraph(moved, view.edges).groups[0]).toMatchObject({
        input_position: { x: -500, y: 70 },
        output_position: { x: 362, y: 20 },
      });
    });

    it("shows a group's input and output where they were left when it opens again", () => {
      const { nodes, edges } = load(GROUPED);
      const view = openGroup(nodes as GraphNode[], edges, "g");
      const moved = view.nodes.map((node) =>
        node.id === "group-output" ? { ...node, position: { x: 800, y: -40 } } : node,
      );

      const closed = closeGroup(moved, view.edges);
      const reopened = openGroup(closed.nodes as GraphNode[], closed.edges, "g");

      expect(reopened.nodes.find((node) => node.id === "group-output")!.position).toEqual({
        x: 800,
        y: -40,
      });
      expect(reopened.nodes.find((node) => node.id === "group-input")!.position).toEqual({
        x: -278,
        y: 20,
      });
    });

    it("closes a group back to how it was, dropping it if its nodes were all removed", () => {
      const { nodes, edges } = load(GROUPED);
      const view = openGroup(nodes as GraphNode[], edges, "g");

      const closed = closeGroup(view.nodes, view.edges);
      const emptied = closeGroup(
        view.nodes.filter((node) => node.parentNode !== "g" || node.id.startsWith("group-")),
        view.edges,
      );

      expect(closed.nodes.map((node) => [node.id, node.hidden])).toEqual([
        ["g", false],
        ["field", true],
        ["sampler", true],
        ["quantize", false],
      ]);
      expect(closed.edges).toEqual(edges);
      expect(emptied.nodes.map((node) => node.id)).toEqual(["quantize"]);
    });

    it("turns a connection to a group's port into one to the node behind it", () => {
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
