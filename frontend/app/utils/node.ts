// Size of VueFlow's default node (theme-default.css), used to center it on the pointer
export const NODE_SIZE = { width: 180, height: 40 };

// Shared by the canvas and the sidebar list so both use the same flow store
export const FLOW_ID = "study-flow";

// A node as stored in the database
export interface SavedNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  // id of the container this node sits inside (x and y are then relative to it), or null
  parent: string | null;
  data: Record<string, unknown>;
}

// An obskit Axis as edited on a Domain node
export interface AxisData {
  name: string;
  extent: [number, number];
  unit: string;
}

// How a Data node shows what a sampler outputs: the first rows only, in a list that renders just the
// ones in view
export const DATA_PREVIEW = { rows: 50, visible: 5, rowHeight: 24 };

const DEFAULT_AXIS_NAMES = ["x", "y", "z"];

// Next axis for a Domain: the first of obskit's default names (x, y, z, then x3, x4, ...)
// that is not already taken, with a unit-interval extent
export function newAxis(existing: AxisData[]): AxisData {
  const taken = new Set(existing.map((a) => a.name));
  let i = 0;
  let name = DEFAULT_AXIS_NAMES[i] ?? `x${i}`;
  while (taken.has(name)) {
    i++;
    name = DEFAULT_AXIS_NAMES[i] ?? `x${i}`;
  }
  return { name, extent: [0, 1], unit: "" };
}

// crypto.randomUUID() needs a secure context, so build the id by hand
export function newNodeId() {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Size of a Preview node's plot (2:1) and of its dots (obskit leaves both to the caller),
// plus the extra width of the node's padding and border
export const PREVIEW_PLOT = { width: 760, height: 380, dotSize: 3 };
const NODE_CHROME_WIDTH = 22;

// Node categories; each maps to a colour via the .cat-* classes in main.css
export type NodeCategory = "core" | "sampling" | "fields" | "defects";

// A parameter of an obskit class, edited as an input on the node: a number (whole or not),
// or one of a fixed set of choices. A null default means "unset": the input starts empty and
// obskit uses its own default (e.g. Clip's lo/hi have no bound).
// (a number list holds one value per axis of a connected Domain, see `perAxisOf`)
export type ParamValue = number | string | null | number[];

export interface ParamSpec {
  name: string;
  default: ParamValue;
  step?: number;
  min?: number;
  minExclusive?: boolean; // the value must be greater than min, not equal to it
  max?: number;
  integer?: boolean;
  options?: { label: string; value: string }[]; // makes it a choice instead of a number
  placeholder?: string; // what an unset optional value is called (e.g. "none")
  // id of a port: while a Domain is connected there, show one field per axis of that Domain
  // (saved as a list); otherwise a single field (saved as one number, applied to every axis)
  perAxisOf?: string;
}

// Which nodes may be connected to an input: any node of the listed categories or kinds
export interface InputRule {
  categories?: NodeCategory[];
  types?: string[];
}

// An input that belongs to a field of the node (e.g. GaussianField's domain): its handle sits
// next to that field instead of in the header
export interface Port {
  id: string;
  label: string;
  accepts: InputRule;
}

// An area of a container that takes the nodes its rule accepts
export interface Zone {
  id: string;
  label: string; // shown on the area's edge
  hint: string; // shown while the area is empty
  accepts: InputRule;
  max?: number; // how many nodes it takes (unlimited if omitted)
  minHeight: number; // the area is at least this tall; it grows with what it holds
  ordered?: boolean; // its nodes are listed in the order they are connected in
}

export interface NodeKind {
  type: string;
  label: string;
  icon: string;
  category: NodeCategory;
  // node width in px when it needs more than NODE_SIZE.width
  width?: number;
  // zones make the node a container (the Observer): areas below its header in which nodes can be
  // placed. A node placed in a zone is laid out by the container (see containerLayout), so the
  // container grows with what it holds
  zones?: Zone[];
  // width once the node has something to show (e.g. a Preview with a connected defect)
  expandedWidth?: number;
  // parameters edited on the node body (stored in the node's data as `params`)
  params?: ParamSpec[];
  // every kind has an input on the left and an output on the right unless it has none
  input?: boolean;
  output?: boolean;
  // what may be connected to the header input (nothing if omitted)
  accepts?: InputRule;
  // inputs next to a field of the node
  ports?: Port[];
  // a sampler that draws at random (its plot depends on a seed)
  seeded?: boolean;
}

export const nodeWidth = (kind: NodeKind) => kind.width ?? NODE_SIZE.width;

// A random draw (of a run, a preview, a plot or a field): the same seed always gives the same result
const SEED: ParamSpec = {
  name: "seed",
  default: 0,
  min: 0,
  max: 2147483647,
  step: 1,
  integer: true,
};

// A defect's input takes another defect: connected defects form a chain, an ordered list of
// stages (see "Defect chains" in docs/decisions.md)
// (a sampler outside an Observer may feed the first of them)
const DEFECT_INPUT: InputRule = {
  categories: ["defects"],
  types: ["gridSampler", "pointSampler"],
};

// A sampler outside an Observer takes a latent: a field
const SAMPLER_INPUT: InputRule = { categories: ["fields"] };

// The kinds of node that can be dragged onto the canvas, named after their obskit classes.
// Icon names must stay literal strings so Nuxt Icon bundles them.
export const NODE_KINDS: NodeKind[] = [
  // core
  {
    type: "observer",
    label: "Observer",
    icon: "i-lucide-eye",
    category: "core",
    width: 280,
    // two areas under the white inputs section: one for the sampler, and a list of the defects
    // (stages), which grows as they are added and is in the order they are connected in
    zones: [
      {
        id: "sampler",
        label: "sampler",
        hint: "Drop a sampler here",
        accepts: { types: ["gridSampler", "pointSampler"] },
        max: 1,
        minHeight: 56,
      },
      {
        id: "stages",
        label: "stages",
        hint: "Drop defects here",
        accepts: { categories: ["defects"] },
        minHeight: 160,
        ordered: true,
      },
    ],
    // inputs live in the white section above the zones (see ContainerBody)
    input: false,
    ports: [{ id: "latent", label: "latent", accepts: { categories: ["fields"] } }],
    // the seed of the run: the same seed always gives the same observation
    params: [SEED],
  },
  {
    type: "preview",
    label: "Preview",
    icon: "i-lucide-chart-line",
    category: "core",
    expandedWidth: PREVIEW_PLOT.width + NODE_CHROME_WIDTH,
    params: [SEED],
    output: false,
    accepts: { categories: ["defects"] },
  },
  {
    type: "plot",
    label: "Plot",
    icon: "i-lucide-chart-spline",
    category: "core",
    expandedWidth: PREVIEW_PLOT.width + NODE_CHROME_WIDTH,
    // shown only for a sampler that draws at random (NodePlot)
    params: [SEED],
    output: false,
    // a sampler's plot, once the sampler has a latent
    accepts: { types: ["gridSampler", "pointSampler"] },
  },
  {
    type: "data",
    label: "Data",
    icon: "i-lucide-table",
    category: "core",
    expandedWidth: 420,
    // the sampler's random draw, shown only for a sampler that draws at random (as on a Plot)
    params: [SEED],
    output: false,
    // what a sampler outputs, as rows
    accepts: { types: ["gridSampler", "pointSampler"] },
  },
  {
    type: "domain",
    label: "Domain",
    icon: "i-lucide-box",
    category: "sampling",
    width: 460,
    input: false,
  },
  {
    type: "gridSampler",
    label: "GridSampler",
    icon: "i-lucide-grid-3x3",
    category: "sampling",
    accepts: SAMPLER_INPUT,
    // samples per axis: one number for every axis (obskit also takes one per axis of the field's
    // domain, which this node cannot see)
    params: [{ name: "shape", default: 64, min: 1, step: 1, integer: true }],
  },
  {
    type: "pointSampler",
    label: "PointSampler",
    icon: "i-lucide-chart-scatter",
    category: "sampling",
    accepts: SAMPLER_INPUT,
    // how many random points are drawn
    params: [{ name: "n", default: 100, min: 0, step: 10, integer: true }],
    seeded: true,
  },
  // fields
  {
    type: "gaussianField",
    label: "GaussianField",
    icon: "i-lucide-waves",
    category: "fields",
    width: 240,
    input: false,
    // GaussianField needs a Domain: its handle sits next to the domain field
    ports: [{ id: "domain", label: "domain", accepts: { types: ["domain"] } }],
    params: [
      { name: "length_scale", default: 0.1, min: 0, minExclusive: true, step: 0.05 },
      { name: "amplitude", default: 1, step: 0.1 },
      { name: "mean", default: 0, step: 0.1 },
      // grid points per axis: one number for all axes, or one per axis of the connected Domain
      { name: "resolution", default: 128, min: 1, step: 1, integer: true, perAxisOf: "domain" },
      // interpolation spline order between grid points: 0 nearest, 1 linear, 3 cubic (obskit
      // accepts 0 to 5)
      { name: "order", default: 1, min: 0, max: 5, step: 1, integer: true },
      // the random draw of the field: the same seed always gives the same realization
      SEED,
    ],
  },
  { type: "analyticField", label: "AnalyticField", icon: "i-lucide-sigma", category: "fields" },
  // defects
  {
    type: "randomDropout",
    label: "RandomDropout",
    icon: "i-lucide-eraser",
    category: "defects",
    accepts: DEFECT_INPUT,
    // probability that each entry is dropped; obskit requires 0 <= p <= 1
    params: [{ name: "p", default: 0.1, min: 0, max: 1, step: 0.05 }],
  },
  {
    type: "gaussianNoise",
    label: "GaussianNoise",
    icon: "i-lucide-audio-lines",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [
      { name: "sigma", default: 1, min: 0, step: 0.1 },
      { name: "mean", default: 0, step: 0.1 },
    ],
  },
  {
    type: "poissonNoise",
    label: "PoissonNoise",
    icon: "i-lucide-dices",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "scale", default: 1, min: 0, minExclusive: true, step: 1 }],
  },
  {
    type: "quantize",
    label: "Quantize",
    icon: "i-lucide-chart-no-axes-column",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [
      { name: "levels", default: 256, min: 2, step: 1, integer: true },
      { name: "vmin", default: null, step: 0.1, placeholder: "auto" },
      { name: "vmax", default: null, step: 0.1, placeholder: "auto" },
    ],
  },
  {
    type: "clip",
    label: "Clip",
    icon: "i-lucide-scissors",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [
      { name: "lo", default: null, step: 0.1, placeholder: "none" },
      { name: "hi", default: null, step: 0.1, placeholder: "none" },
    ],
  },
  {
    type: "saturate",
    label: "Saturate",
    icon: "i-lucide-contrast",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "ceiling", default: 1, min: 0, minExclusive: true, step: 0.1 }],
  },
  {
    type: "valueOffset",
    label: "ValueOffset",
    icon: "i-lucide-move-vertical",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "value", default: 0, step: 0.1 }],
  },
  {
    type: "gain",
    label: "Gain",
    icon: "i-lucide-volume-2",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "factor", default: 1, step: 0.1 }],
  },
  {
    type: "drift",
    label: "Drift",
    icon: "i-lucide-trending-up",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [
      { name: "rate", default: 0, step: 0.1 },
      // the preview signal has axes x and y; unset drifts along the sample order instead
      {
        name: "axis",
        default: null,
        placeholder: "sample order",
        options: [
          { label: "x", value: "x" },
          { label: "y", value: "y" },
        ],
      },
    ],
  },
  {
    type: "coordinateShift",
    label: "CoordinateShift",
    icon: "i-lucide-move",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "shift", default: 0, step: 0.1 }],
  },
];

// Nodes saved before a kind existed (e.g. the old "placeholder") still need to render
const FALLBACK_KIND: Omit<NodeKind, "type" | "label"> = {
  icon: "i-lucide-box",
  category: "core",
};

export function kindOf(type: string | undefined, label = ""): NodeKind {
  return NODE_KINDS.find((k) => k.type === type) ?? { type: type ?? "", label, ...FALLBACK_KIND };
}

// The height of a node's header
export const HEADER_HEIGHT = NODE_SIZE.height;

// A container with inputs has a white section under its header: a row of fields is 28px (24px
// plus a 4px gap), plus its padding
export const containerTopHeight = (kind: NodeKind) => {
  const rows = (kind.ports?.length ?? 0) + (kind.params?.length ?? 0);
  return rows ? rows * 28 + 12 : 0;
};

// The zone of a container kind that takes nodes of the `child` kind, if any
export function zoneFor(container: NodeKind, child: string | undefined) {
  const kind = kindOf(child);
  return container.zones?.find(
    (z) => z.accepts.categories?.includes(kind.category) || z.accepts.types?.includes(kind.type),
  );
}

// Whether a node type is one of the defects
export const isDefectKind = (type: string | undefined) => kindOf(type).category === "defects";

// Whether an output of the `source` kind may be connected to an input of the `target` kind:
// the header input, or the port with id `handle`
export function canConnect(
  source: string | undefined,
  target: string | undefined,
  handle?: string | null,
) {
  const targetKind = kindOf(target);
  const sourceKind = kindOf(source);
  const rule = handle
    ? targetKind.ports?.find((p) => p.id === handle)?.accepts
    : targetKind.accepts;
  return (
    !!rule &&
    !!(rule.categories?.includes(sourceKind.category) || rule.types?.includes(sourceKind.type))
  );
}

// A connection between two nodes as stored in the database; the handles say which output /
// input of the nodes it uses (null = the header's)
export interface SavedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

// A kind's parameters at their defaults; saved values for its declared parameters override them
// (anything else saved on the node is ignored)
export function paramsOf(
  kind: NodeKind,
  saved?: Record<string, ParamValue>,
): Record<string, ParamValue> {
  return Object.fromEntries(
    (kind.params ?? []).map((spec) => {
      const value = saved?.[spec.name];
      const isNumber = typeof value === "number";
      const fits = spec.options
        ? typeof value === "string"
        : spec.perAxisOf
          ? isNumber || (Array.isArray(value) && value.every((v) => typeof v === "number"))
          : isNumber || (value === null && spec.default === null);
      return [spec.name, fits ? (value as ParamValue) : spec.default];
    }),
  );
}
