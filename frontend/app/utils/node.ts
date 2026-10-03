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

// Next axis for a Domain: obskit's default names (x, y, z, then x3, x4, ...), unit interval
export function newAxis(existing: AxisData[]): AxisData {
  const n = existing.length;
  const name = DEFAULT_AXIS_NAMES[n] ?? `x${n}`;
  return { name, extent: [0, 1], unit: "" };
}

// crypto.randomUUID() needs a secure context, so build the id by hand
export function newNodeId() {
  return `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Node categories; each maps to a colour via the .cat-* classes in main.css
export type NodeCategory = "core" | "fields" | "defects";

export interface NodeKind {
  type: string;
  label: string;
  icon: string;
  category: NodeCategory;
  // node width in px when it needs more than NODE_SIZE.width
  width?: number;
}

export const nodeWidth = (kind: NodeKind) => kind.width ?? NODE_SIZE.width;

// The kinds of node that can be dragged onto the canvas, named after their obskit classes.
// Icon names must stay literal strings so Nuxt Icon bundles them.
export const NODE_KINDS: NodeKind[] = [
  // core
  { type: "observer", label: "Observer", icon: "i-lucide-eye", category: "core" },
  { type: "domain", label: "Domain", icon: "i-lucide-box", category: "core", width: 340 },
  { type: "gridSampler", label: "GridSampler", icon: "i-lucide-grid-3x3", category: "core" },
  { type: "pointSampler", label: "PointSampler", icon: "i-lucide-chart-scatter", category: "core" },
  // fields
  { type: "gaussianField", label: "GaussianField", icon: "i-lucide-waves", category: "fields" },
  { type: "analyticField", label: "AnalyticField", icon: "i-lucide-sigma", category: "fields" },
  // defects
  { type: "randomDropout", label: "RandomDropout", icon: "i-lucide-eraser", category: "defects" },
  {
    type: "gaussianNoise",
    label: "GaussianNoise",
    icon: "i-lucide-audio-lines",
    category: "defects",
  },
  { type: "poissonNoise", label: "PoissonNoise", icon: "i-lucide-dices", category: "defects" },
  {
    type: "quantize",
    label: "Quantize",
    icon: "i-lucide-chart-no-axes-column",
    category: "defects",
  },
  { type: "clip", label: "Clip", icon: "i-lucide-scissors", category: "defects" },
  { type: "saturate", label: "Saturate", icon: "i-lucide-contrast", category: "defects" },
  {
    type: "valueOffset",
    label: "ValueOffset",
    icon: "i-lucide-move-vertical",
    category: "defects",
  },
  { type: "gain", label: "Gain", icon: "i-lucide-volume-2", category: "defects" },
  { type: "drift", label: "Drift", icon: "i-lucide-trending-up", category: "defects" },
  {
    type: "coordinateShift",
    label: "CoordinateShift",
    icon: "i-lucide-move",
    category: "defects",
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
