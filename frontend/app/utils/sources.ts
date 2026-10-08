// What a node shows (a Data node's rows, a Plot's or a Preview's figure) comes from asking the backend
// to run what is connected to it. Everything here works on a plain graph, the nodes and connections
// as saved, so it serves both the canvas (whose graph is VueFlow's) and the tasks (which only have
// the saved one).

export interface GraphNodeLike {
  id: string;
  parentNode?: string | null;
  data?: { type?: string; params?: Record<string, ParamValue>; axes?: AxisData[] };
}
export interface GraphLike {
  nodes: GraphNodeLike[];
  edges: { source: string; target: string; targetHandle?: string | null }[];
}

// A saved study's graph as one `GraphLike` (a saved node has its type beside its data)
export const graphOf = (saved: { nodes: SavedNode[]; edges: SavedEdge[] }): GraphLike => ({
  nodes: saved.nodes.map((n) => ({
    id: n.id,
    parentNode: n.parent,
    data: { ...n.data, type: n.type },
  })),
  edges: saved.edges,
});

// The nodes that show or output something, and so can be a source for a task
export type SourceKind = "data" | "plot" | "preview" | "observer";
export const SOURCE_KINDS: SourceKind[] = ["data", "plot", "preview", "observer"];

// What to ask the backend for to run a node's source
export interface SourceRequest {
  kind: SourceKind; // which of the nodes asks
  type: string; // the type of the node connected to it (a sampler, or a defect; an Observer's own)
  body?: object; // a sampler on its latent (Data and Plot), with its stages for an Observer
  query?: Record<string, ParamValue>; // a defect's parameters (Preview)
  waiting?: string; // what is still missing when it cannot be run yet
}

// How to ask for a request, as `$fetch` options (a Plot of an Observer plots every step)
export const endpointOf = (request: SourceRequest) =>
  request.kind === "preview"
    ? { url: `/api/preview/${request.type}`, query: request.query }
    : {
        url:
          request.kind === "plot" && request.type === "observer"
            ? "/api/observer/plot"
            : `/api/${request.kind}`,
        method: "POST" as const,
        body: request.body,
      };

// The rows a Data node shows
export interface DataRows {
  columns: string[];
  rowCount: number;
  rows: (number | null)[][];
}

// four or five significant digits are plenty to read; an invalid sample has no value
export const formatCell = (v: number | null) =>
  v === null ? "—" : String(Number(v.toPrecision(5)));

// the connection into an input of `id` (the header's unless `handle` names a port)
const edgeInto = (graph: GraphLike, id: string, handle?: string) =>
  graph.edges.find((e) => e.target === id && (e.targetHandle ?? undefined) === handle);

const nodeOf = (graph: GraphLike, id: string | undefined) => graph.nodes.find((n) => n.id === id);

// Parameter values for the backend; unset (null) ones are left out, so obskit uses its own default
const valuesOf = (node: GraphNodeLike) =>
  Object.fromEntries(
    Object.entries(paramsOf(kindOf(node.data?.type), node.data?.params)).filter(
      ([, v]) => v !== null,
    ),
  );

// The field on a connection into a latent input (a sampler's, or an Observer's latent port) and that
// field's domain, as the backend needs them; or what is missing
function latentOf(
  graph: GraphLike,
  latentEdge: GraphLike["edges"][number] | undefined,
  to: string, // what the latent is for, for the message
) {
  const field = nodeOf(graph, latentEdge?.source);
  if (!field) return { waiting: `Connect a latent to ${to}` };
  // a GaussianField is the one latent that can be built from what the nodes hold
  if (field.data?.type !== "gaussianField") {
    return { waiting: `${kindOf(field.data?.type).label} is not supported yet` };
  }
  const domainEdge = edgeInto(graph, field.id, "domain");
  const axes = nodeOf(graph, domainEdge?.source)?.data?.axes;
  if (!axes?.length) return { waiting: "Connect a domain to the field" };
  const { seed: fieldSeed, ...values } = valuesOf(field);
  const fieldParams: Record<string, unknown> = values;
  // A per-axis list (the resolution) is saved with the axes it was edited for; after an axis is
  // added or deleted its length no longer matches, and obskit rejects that. Fit it to the axes.
  for (const spec of kindOf(field.data?.type).params ?? []) {
    const list = fieldParams[spec.name];
    if (spec.perAxisOf && Array.isArray(list)) {
      fieldParams[spec.name] = Array.from(
        { length: axes.length },
        (_, i) => list[i] ?? list.at(-1) ?? spec.default,
      );
    }
  }
  return { latent: { axes, field_params: fieldParams, field_seed: fieldSeed } };
}

// The sampler on its latent: the field on the sampler's input (or, for a sampler inside an Observer,
// on the Observer's latent port) and that field's domain. `seed` is the sampler's, used only if it
// draws at random (the field's seed is the field's own).
function samplerRequest(
  graph: GraphLike,
  kind: "data" | "plot",
  sampler: GraphNodeLike,
  seed: unknown,
): SourceRequest {
  const type = String(sampler.data?.type);
  const parent = sampler.parentNode ? nodeOf(graph, sampler.parentNode) : undefined;
  const found = latentOf(
    graph,
    parent ? edgeInto(graph, parent.id, "latent") : edgeInto(graph, sampler.id),
    parent ? "the Observer" : "the sampler",
  );
  if (!found.latent) return { kind, type, waiting: found.waiting };
  return {
    kind,
    type,
    body: {
      sampler: type,
      sampler_params: valuesOf(sampler),
      ...found.latent,
      seed: kindOf(type).seeded ? seed : 0,
    },
  };
}

// An Observer: its sampler, then its stages (the defects, in the order they are connected in), on
// the latent at its port, run with its own seed
function observerRequest(graph: GraphLike, observer: GraphNodeLike): SourceRequest {
  const kind = kindOf("observer");
  const waiting = (reason: string): SourceRequest => ({
    kind: "observer",
    type: "observer",
    waiting: reason,
  });
  const members = graph.nodes.filter((n) => n.parentNode === observer.id);
  const inZone = (zone: string) => members.filter((n) => zoneFor(kind, n.data?.type)?.id === zone);
  const sampler = inZone("sampler")[0];
  if (!sampler) return waiting("Put a sampler in the Observer");
  const found = latentOf(graph, edgeInto(graph, observer.id, "latent"), "the Observer");
  if (!found.latent) return waiting(found.waiting);
  const stages = chainOrder(
    inZone("stages").map((n) => n.id),
    graph.edges,
  ).map((id) => nodeOf(graph, id)!);
  return {
    kind: "observer",
    type: "observer",
    body: {
      sampler: sampler.data?.type,
      sampler_params: valuesOf(sampler),
      stages: stages.map((n) => ({ type: n.data?.type, params: valuesOf(n) })),
      ...found.latent,
      seed: paramsOf(kind, observer.data?.params).seed,
    },
  };
}

// What to ask the backend for to run the Data, Plot, Preview or Observer node `id`, from what is connected to
// its input; nothing if nothing is. A Preview shows the connected defect on the demo signal (the seed
// is the Preview's, the rest the defect's); a Data node and a Plot show the connected sampler (a Plot also takes an Observer).
export function requestOf(graph: GraphLike, id: string): SourceRequest | undefined {
  const node = nodeOf(graph, id);
  const kind = node?.data?.type as SourceKind | undefined;
  if (!node || !kind || !SOURCE_KINDS.includes(kind)) return undefined;
  if (kind === "observer") return observerRequest(graph, node);
  const source = nodeOf(graph, edgeInto(graph, id)?.source);
  if (!source?.data?.type) return undefined;
  if (kind === "plot" && source.data.type === "observer") {
    return { ...observerRequest(graph, source), kind };
  }
  const own = paramsOf(kindOf(kind), node.data?.params);
  if (kind === "preview") {
    return { kind, type: source.data.type, query: { ...valuesOf(source), ...own } };
  }
  return samplerRequest(graph, kind, source, own.seed);
}
