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
  data: Record<string, unknown>;
}

// An obskit Axis as edited on a Domain node
export interface AxisData {
  name: string;
  extent: [number, number];
  unit: string;
}

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
export type NodeCategory = "core" | "fields" | "defects";

// A parameter of an obskit class, edited as an input on the node: a number (whole or not),
// or one of a fixed set of choices. A null default means "unset": the input starts empty and
// obskit uses its own default (e.g. Clip's lo/hi have no bound).
export type ParamValue = number | string | null;

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
}

export interface NodeKind {
  type: string;
  label: string;
  icon: string;
  category: NodeCategory;
  // node width in px when it needs more than NODE_SIZE.width
  width?: number;
  // width once the node has something to show (e.g. a Preview with a connected defect)
  expandedWidth?: number;
  // parameters edited on the node body (stored in the node's data as `params`)
  params?: ParamSpec[];
  // every kind has an input on the left and an output on the right unless it has none
  input?: boolean;
  output?: boolean;
  // categories whose nodes may be connected to this kind's input (none if omitted)
  accepts?: NodeCategory[];
}

export const nodeWidth = (kind: NodeKind) => kind.width ?? NODE_SIZE.width;

// The kinds of node that can be dragged onto the canvas, named after their obskit classes.
// Icon names must stay literal strings so Nuxt Icon bundles them.
export const NODE_KINDS: NodeKind[] = [
  // core
  { type: "observer", label: "Observer", icon: "i-lucide-eye", category: "core" },
  {
    type: "domain",
    label: "Domain",
    icon: "i-lucide-box",
    category: "core",
    width: 460,
    input: false,
  },
  { type: "gridSampler", label: "GridSampler", icon: "i-lucide-grid-3x3", category: "core" },
  { type: "pointSampler", label: "PointSampler", icon: "i-lucide-chart-scatter", category: "core" },
  {
    type: "preview",
    label: "Preview",
    icon: "i-lucide-chart-line",
    category: "core",
    expandedWidth: PREVIEW_PLOT.width + NODE_CHROME_WIDTH,
    // the random draw behind the plot; the same seed always gives the same preview
    params: [{ name: "seed", default: 0, min: 0, max: 2147483647, step: 1, integer: true }],
    output: false,
    accepts: ["defects"],
  },
  // fields
  { type: "gaussianField", label: "GaussianField", icon: "i-lucide-waves", category: "fields" },
  { type: "analyticField", label: "AnalyticField", icon: "i-lucide-sigma", category: "fields" },
  // defects
  {
    type: "randomDropout",
    label: "RandomDropout",
    icon: "i-lucide-eraser",
    category: "defects",
    // probability that each entry is dropped; obskit requires 0 <= p <= 1
    params: [{ name: "p", default: 0.1, min: 0, max: 1, step: 0.05 }],
  },
  {
    type: "gaussianNoise",
    label: "GaussianNoise",
    icon: "i-lucide-audio-lines",
    category: "defects",
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
    params: [{ name: "scale", default: 1, min: 0, minExclusive: true, step: 1 }],
  },
  {
    type: "quantize",
    label: "Quantize",
    icon: "i-lucide-chart-no-axes-column",
    category: "defects",
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
    params: [{ name: "ceiling", default: 1, min: 0, minExclusive: true, step: 0.1 }],
  },
  {
    type: "valueOffset",
    label: "ValueOffset",
    icon: "i-lucide-move-vertical",
    category: "defects",
    params: [{ name: "value", default: 0, step: 0.1 }],
  },
  {
    type: "gain",
    label: "Gain",
    icon: "i-lucide-volume-2",
    category: "defects",
    params: [{ name: "factor", default: 1, step: 0.1 }],
  },
  {
    type: "drift",
    label: "Drift",
    icon: "i-lucide-trending-up",
    category: "defects",
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

// Whether an output of the `source` kind may be connected to the input of the `target` kind
export function canConnect(source: string | undefined, target: string | undefined) {
  return kindOf(target).accepts?.includes(kindOf(source).category) ?? false;
}

// A connection between two nodes as stored in the database
export interface SavedEdge {
  id: string;
  source: string;
  target: string;
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
      const fits = spec.options
        ? typeof value === "string"
        : typeof value === "number" || (value === null && spec.default === null);
      return [spec.name, fits ? (value as ParamValue) : spec.default];
    }),
  );
}
