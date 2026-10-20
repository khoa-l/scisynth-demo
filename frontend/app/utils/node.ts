// VueFlow's default node size, used to center a dropped node on the pointer
export const NODE_SIZE = { width: 180, height: 40 };

// Flow store id shared by the canvas and the sidebar list
export const FLOW_ID = "study-flow";

// A node as stored in the database
export interface SavedNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  // container this node sits in (x, y are then relative to it)
  parent: string | null;
  data: Record<string, unknown>;
}

// An obskit Axis as edited on a Domain node
export interface AxisData {
  name: string;
  extent: [number, number];
  unit: string;
}

// Data node table: rows shown and row height
export const DATA_PREVIEW = { visible: 5, rowHeight: 28 };

const DEFAULT_AXIS_NAMES = ["x", "y", "z"];

// Next Domain axis: the first free default name (x, y, z, x3, ...) over [0, 1]
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

// (crypto.randomUUID needs a secure context)
export function newNodeId() {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Plot size and dot size, and the node's padding and border width
export const PREVIEW_PLOT = { width: 760, height: 380, dotSize: 3 };
const NODE_CHROME_WIDTH = 22;

// Each maps to a colour via .cat-* in main.css
export type NodeCategory = "core" | "sampling" | "fields" | "defects";

// A number, a choice, or (with `perAxisOf`) a list with one number per axis. A null default means
// unset: obskit uses its own.
export type ParamValue = number | string | null | number[];

export interface ParamSpec {
  name: string;
  default: ParamValue;
  step?: number;
  min?: number;
  minExclusive?: boolean; // must be greater than min
  max?: number;
  integer?: boolean;
  options?: { label: string; value: string }[]; // a choice instead of a number
  text?: boolean; // typed text instead of a number
  placeholder?: string; // shown while unset
  // port id: with a Domain connected there, one field per axis (saved as a list)
  perAxisOf?: string;
}

// What may connect to an input: nodes of these categories or types
export interface InputRule {
  categories?: NodeCategory[];
  types?: string[];
}

// An input with its handle next to a field instead of in the header
export interface Port {
  id: string;
  label: string;
  accepts: InputRule;
  multiple?: boolean; // takes any number of connections, in connection order
}

// An area of a container that takes the nodes its rule accepts
export interface Zone {
  id: string;
  label: string;
  hint: string; // shown while empty
  accepts: InputRule;
  max?: number; // unlimited if omitted
  minHeight: number; // grows with what it holds
  ordered?: boolean; // nodes are listed in connection order
}

export interface NodeKind {
  type: string;
  label: string;
  icon: string;
  category: NodeCategory;
  // px, if wider than NODE_SIZE.width
  width?: number;
  // makes the node a container (the Observer); see containerLayout
  zones?: Zone[];
  // width once it has something to show
  expandedWidth?: number;
  // edited on the node body, stored in data.params
  params?: ParamSpec[];
  // an input and an output unless false
  input?: boolean;
  output?: boolean;
  // header input rule (nothing connects if omitted)
  accepts?: InputRule;
  // inputs beside a field
  ports?: Port[];
  // draws at random, so its plot depends on a seed
  seeded?: boolean;
}

export const nodeWidth = (kind: NodeKind) => kind.width ?? NODE_SIZE.width;

// The same seed always gives the same result
const SEED: ParamSpec = {
  name: "seed",
  default: 0,
  min: 0,
  max: 2147483647,
  step: 1,
  integer: true,
};

// Defects chain (see "Defect chains" in docs/decisions.md); a sampler may feed the first
const DEFECT_INPUT: InputRule = {
  categories: ["defects"],
  types: ["gridSampler", "pointSampler"],
};

// A sampler's latent is a field
const SAMPLER_INPUT: InputRule = { categories: ["fields"] };

// What a Multichannel or a Math takes: one field per channel or term (a Multichannel is not one)
const FIELD_TERMS = ["gaussianField", "analyticField", "math"];

// Icon names must stay literal strings so Nuxt Icon bundles them.
export const NODE_KINDS: NodeKind[] = [
  // core
  {
    type: "observer",
    label: "Observer",
    icon: "i-lucide-eye",
    category: "core",
    width: 280,
    // the sampler, and the defects (stages) in connection order
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
    // inputs sit above the zones (see ContainerBody)
    input: false,
    ports: [{ id: "latent", label: "latent", accepts: { categories: ["fields"] } }],
    params: [SEED],
  },
  {
    type: "trace",
    label: "Trace",
    icon: "i-lucide-route",
    category: "core",
    // the Observer's run with every step kept; plot it
    accepts: { types: ["observer"] },
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
    params: [SEED],
    output: false,
    accepts: { types: ["gridSampler", "pointSampler", "observer", "trace"] },
  },
  {
    type: "data",
    label: "Data",
    icon: "i-lucide-table",
    category: "core",
    expandedWidth: 420,
    params: [SEED],
    output: false,
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
    // one number for every axis
    params: [{ name: "shape", default: 64, min: 1, step: 1, integer: true }],
  },
  {
    type: "pointSampler",
    label: "PointSampler",
    icon: "i-lucide-chart-scatter",
    category: "sampling",
    accepts: SAMPLER_INPUT,
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
    ports: [{ id: "domain", label: "domain", accepts: { types: ["domain"] } }],
    params: [
      { name: "length_scale", default: 0.1, min: 0, minExclusive: true, step: 0.05 },
      { name: "amplitude", default: 1, step: 0.1 },
      { name: "mean", default: 0, step: 0.1 },
      { name: "resolution", default: 128, min: 1, step: 1, integer: true, perAxisOf: "domain" },
      // spline order: 0 nearest, 1 linear, 3 cubic
      { name: "order", default: 1, min: 0, max: 5, step: 1, integer: true },
      SEED,
    ],
  },
  {
    type: "multichannel",
    label: "Multichannel",
    icon: "i-lucide-layers",
    category: "fields",
    width: 240,
    input: false,
    // each connected field is a channel, in connection order
    ports: [{ id: "fields", label: "fields", accepts: { types: FIELD_TERMS }, multiple: true }],
    // between every pair of channels; scisynth refuses 1 and anything below -1 / (channels - 1)
    params: [{ name: "correlation", default: 0, min: -1, max: 1, step: 0.1 }],
  },
  {
    type: "math",
    label: "Math",
    icon: "i-lucide-calculator",
    category: "fields",
    width: 240,
    input: false,
    // the fields combine pointwise, in connection order (they must share a domain)
    ports: [{ id: "fields", label: "fields", accepts: { types: FIELD_TERMS }, multiple: true }],
    params: [
      {
        name: "operation",
        default: "sum",
        options: [
          { label: "Sum", value: "sum" },
          { label: "Product", value: "product" },
        ],
      },
    ],
  },
  {
    type: "analyticField",
    label: "AnalyticField",
    icon: "i-lucide-sigma",
    category: "fields",
    width: 300,
    input: false,
    ports: [{ id: "domain", label: "domain", accepts: { types: ["domain"] } }],
    // one argument per axis, in order; the backend allows arithmetic, comparisons, sin, cos, sqrt,
    // where, clip... (np.sin works too), and nothing else
    params: [
      {
        name: "func",
        default: "lambda x, y: 0.1 * x",
        text: true,
        placeholder: "lambda x, y: ...",
      },
    ],
  },
  // defects
  {
    type: "randomDropout",
    label: "RandomDropout",
    icon: "i-lucide-eraser",
    category: "defects",
    accepts: DEFECT_INPUT,
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
      // the preview signal has axes x and y
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
  // for points: PointSampler's output
  {
    type: "positionJitter",
    label: "PositionJitter",
    icon: "i-lucide-vibrate",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "sigma", default: 0, min: 0, step: 0.01 }],
  },
  {
    type: "randomInsertion",
    label: "RandomInsertion",
    icon: "i-lucide-circle-plus",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "n", default: 10, min: 0, step: 1, integer: true }],
  },
  // for a grid: GridSampler's output
  {
    type: "downsample",
    label: "Downsample",
    icon: "i-lucide-shrink",
    category: "defects",
    accepts: DEFECT_INPUT,
    params: [{ name: "factor", default: 2, min: 1, step: 1, integer: true }],
  },
];

// For nodes saved before their kind existed
const FALLBACK_KIND: Omit<NodeKind, "type" | "label"> = {
  icon: "i-lucide-box",
  category: "core",
};

export function kindOf(type: string | undefined, label = ""): NodeKind {
  return NODE_KINDS.find((k) => k.type === type) ?? { type: type ?? "", label, ...FALLBACK_KIND };
}

// The height of a node's header
export const HEADER_HEIGHT = NODE_SIZE.height;

// Inputs section under a container's header: 28px a row, plus padding
export const containerTopHeight = (kind: NodeKind) => {
  const rows = (kind.ports?.length ?? 0) + (kind.params?.length ?? 0);
  return rows ? rows * 28 + 12 : 0;
};

// The zone of `container` that takes `child`, if any
export function zoneFor(container: NodeKind, child: string | undefined) {
  const kind = kindOf(child);
  return container.zones?.find(
    (z) => z.accepts.categories?.includes(kind.category) || z.accepts.types?.includes(kind.type),
  );
}

// Whether a node type is one of the defects
export const isDefectKind = (type: string | undefined) => kindOf(type).category === "defects";

// Whether `source` may connect to `target`'s header input, or its port `handle`
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

// A connection as stored; null handles are the header's
export interface SavedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
}

// A kind's parameters: saved values that fit override the defaults
export function paramsOf(
  kind: NodeKind,
  saved?: Record<string, ParamValue>,
): Record<string, ParamValue> {
  return Object.fromEntries(
    (kind.params ?? []).map((spec) => {
      const value = saved?.[spec.name];
      const isNumber = typeof value === "number";
      const fits =
        spec.options || spec.text
          ? typeof value === "string"
          : spec.perAxisOf
            ? isNumber || (Array.isArray(value) && value.every((v) => typeof v === "number"))
            : isNumber || (value === null && spec.default === null);
      return [spec.name, fits ? (value as ParamValue) : spec.default];
    }),
  );
}
