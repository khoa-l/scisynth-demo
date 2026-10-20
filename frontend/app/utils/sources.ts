// What a node shows comes from asking the backend to run what is connected to it. This works on a
// plain graph (nodes and edges as saved), so it serves both the canvas and the tasks.

export interface GraphNodeLike {
  id: string;
  parentNode?: string | null;
  data?: { type?: string; params?: Record<string, ParamValue>; axes?: AxisData[] };
}
export interface GraphLike {
  nodes: GraphNodeLike[];
  edges: { source: string; target: string; targetHandle?: string | null }[];
}

// A saved study's graph as a `GraphLike`
export const graphOf = (saved: { nodes: SavedNode[]; edges: SavedEdge[] }): GraphLike => ({
  nodes: saved.nodes.map((n) => ({
    id: n.id,
    parentNode: n.parent,
    data: { ...n.data, type: n.type },
  })),
  edges: saved.edges,
});

// Nodes that can be a task's source
export type SourceKind = "data" | "plot" | "preview" | "observer";
export const SOURCE_KINDS: SourceKind[] = ["data", "plot", "preview", "observer"];

// What to ask the backend for
export interface SourceRequest {
  kind: SourceKind;
  type: string; // the connected node's type (an Observer's own)
  body?: object; // sampler on its latent, plus stages for an Observer
  query?: Record<string, ParamValue>; // a defect's parameters (Preview)
  waiting?: string; // what is missing when it cannot run
}

// A Plot of an Observer shows every step; of its Trace, the 3-D view
const PLOTTED_OBSERVER = ["observer", "trace"];

// As `$fetch` options
export const endpointOf = (request: SourceRequest) =>
  request.kind === "preview"
    ? { url: `/api/preview/${request.type}`, query: request.query }
    : {
        url:
          request.kind === "plot" && PLOTTED_OBSERVER.includes(request.type)
            ? `/api/${request.type}/plot`
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

// five significant digits; an invalid sample has no value
export const formatCell = (v: number | null) =>
  v === null ? "—" : String(Number(v.toPrecision(5)));

// the connection into `id`'s header input, or its port `handle`
const edgeInto = (graph: GraphLike, id: string, handle?: string) =>
  graph.edges.find((e) => e.target === id && (e.targetHandle ?? undefined) === handle);

const nodeOf = (graph: GraphLike, id: string | undefined) => graph.nodes.find((n) => n.id === id);

// Parameter values for the backend; unset (null) ones are left out
const valuesOf = (node: GraphNodeLike) =>
  Object.fromEntries(
    Object.entries(paramsOf(kindOf(node.data?.type), node.data?.params)).filter(
      ([, v]) => v !== null,
    ),
  );

// A field and its domain's axes, as the backend needs them, or what is missing
type Found =
  | { field: Record<string, unknown>; axes: AxisData[]; waiting?: undefined }
  | { field?: undefined; axes?: undefined; waiting: string };

// A GaussianField, AnalyticField or Math (the sum or product of the fields on its port). `seen` are
// the Math nodes above it, to stop a loop.
function fieldOf(graph: GraphLike, field: GraphNodeLike, seen: string[] = []): Found {
  const type = field.data?.type;
  if (type === "math") {
    if (seen.includes(field.id)) return { waiting: "The fields loop back on themselves" };
    const terms = fieldsAt(graph, field, [...seen, field.id]);
    if (!terms.fields) return { waiting: terms.waiting };
    if (terms.fields.length < 2) return { waiting: "Connect at least two fields to the Math" };
    const operation = String(valuesOf(field).operation);
    return { axes: terms.axes, field: { operation, terms: terms.fields } };
  }
  if (type !== "gaussianField" && type !== "analyticField") {
    return { waiting: `${kindOf(type).label} is not supported yet` };
  }
  const domainEdge = edgeInto(graph, field.id, "domain");
  const axes = nodeOf(graph, domainEdge?.source)?.data?.axes;
  if (!axes?.length) return { waiting: "Connect a domain to the field" };
  if (type === "analyticField") {
    const expression = String(valuesOf(field).func ?? "").trim();
    if (!expression) return { waiting: "Type a lambda for the field" };
    return { axes, field: { expression } };
  }
  const { seed: fieldSeed, ...values } = valuesOf(field);
  const fieldParams: Record<string, unknown> = values;
  // A per-axis list is saved for the axes it was edited with; fit it to the current ones
  for (const spec of kindOf(field.data?.type).params ?? []) {
    const list = fieldParams[spec.name];
    if (spec.perAxisOf && Array.isArray(list)) {
      fieldParams[spec.name] = Array.from(
        { length: axes.length },
        (_, i) => list[i] ?? list.at(-1) ?? spec.default,
      );
    }
  }
  return { axes, field: { field_params: fieldParams, field_seed: fieldSeed } };
}

// The fields on `node`'s "fields" port, in connection order, which must share one domain
function fieldsAt(graph: GraphLike, node: GraphNodeLike, seen: string[] = []) {
  const found = graph.edges
    .filter((e) => e.target === node.id && e.targetHandle === "fields")
    .map((e) => nodeOf(graph, e.source))
    .filter((n): n is GraphNodeLike => !!n)
    .map((n) => fieldOf(graph, n, seen));
  const label = kindOf(node.data?.type).label;
  if (!found.length) return { waiting: `Connect fields to the ${label}` };
  const missing = found.find((f) => !f.field);
  if (missing) return { waiting: missing.waiting! };
  const axes = found[0]!.axes!;
  if (found.some((f) => JSON.stringify(f.axes) !== JSON.stringify(axes))) {
    return { waiting: "The fields must share one domain" };
  }
  return { axes, fields: found.map((f) => f.field!) };
}

type Latent =
  | { latent: Record<string, unknown>; waiting?: undefined }
  | { latent?: undefined; waiting: string };

// The latent on an input and its domain, as the backend needs it, or what is missing. A Multichannel
// is its fields, one channel each.
function latentOf(
  graph: GraphLike,
  latentEdge: GraphLike["edges"][number] | undefined,
  to: string, // for the message
): Latent {
  const latent = nodeOf(graph, latentEdge?.source);
  if (!latent) return { waiting: `Connect a latent to ${to}` };
  if (latent.data?.type !== "multichannel") {
    const found = fieldOf(graph, latent);
    return found.field
      ? { latent: { axes: found.axes, ...found.field } }
      : { waiting: found.waiting };
  }
  const channels = fieldsAt(graph, latent);
  if (!channels.fields) return { waiting: channels.waiting };
  return {
    latent: {
      axes: channels.axes,
      channels: channels.fields,
      correlation: valuesOf(latent).correlation,
    },
  };
}

// The sampler on its latent (on the Observer's port inside one). `seed` is the sampler's, used only
// if it draws at random.
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

// An Observer: sampler, then stages in connection order, on its latent, with its own seed
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

// What to ask the backend for to run node `id` from what is connected to it; nothing if nothing is.
// A Preview shows the connected defect (seed is the Preview's); Data and Plot show the connected
// sampler (a Plot also takes an Observer or its Trace).
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
  if (kind === "plot" && source.data.type === "trace") {
    const observer = nodeOf(graph, edgeInto(graph, source.id)?.source);
    if (!observer) return { kind, type: "trace", waiting: "Connect an Observer to the Trace" };
    return { ...observerRequest(graph, observer), kind, type: "trace" };
  }
  const own = paramsOf(kindOf(kind), node.data?.params);
  if (kind === "preview") {
    return { kind, type: source.data.type, query: { ...valuesOf(source), ...own } };
  }
  return samplerRequest(graph, kind, source, own.seed);
}
