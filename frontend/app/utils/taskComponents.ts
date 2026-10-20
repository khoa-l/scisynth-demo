// Components that can be dragged into a task, and the data each keeps
export interface TaskComponent {
  type: string;
  label: string;
  icon: string;
}

export const TASK_COMPONENTS: TaskComponent[] = [
  { type: "text", label: "Text", icon: "i-lucide-type" },
  { type: "table", label: "Table", icon: "i-lucide-table" },
  { type: "plot", label: "Plot", icon: "i-lucide-chart-scatter" },
  { type: "cluster", label: "Cluster", icon: "i-lucide-shapes" },
];

// A copy of a workflow node's request, so the component keeps showing the same data until refreshed
export interface SourceSnapshot {
  nodeId: string;
  name: string;
  request: SourceRequest;
}

export interface TextData {
  text: string;
}
export interface TableData {
  source?: SourceSnapshot; // a Data node
}
export interface PlotData {
  source?: SourceSnapshot; // a Plot or Preview node
  interactive: boolean; // zoom, pan and hover; off is a still picture
  colors: boolean; // the source's point colors; off is one color
}
export interface ClusterData {
  source?: SourceSnapshot; // an Observer
  x?: string; // plotted columns
  y?: string;
  color?: string; // column the points are colored by, in ranges
  breaks?: number[]; // where each range ends
  names?: string[]; // range names by position; empty shows the range
  showNoValue?: boolean; // plot points with no value to color by
}
export type ComponentData = TextData | TableData | PlotData | ClusterData;

// A component placed in a task
export interface PlacedComponent {
  uid: number;
  type: string;
  data: ComponentData;
}

// A new component's data
export function initialData(type: string): ComponentData {
  if (type === "text") return { text: "" };
  if (type === "plot") return { interactive: true, colors: true };
  return {};
}

export const taskComponentOf = (type: string) =>
  TASK_COMPONENTS.find((c) => c.type === type) ?? TASK_COMPONENTS[0]!;

// The component type a sidebar drag started on, if any
export const componentTypeOf = (id: unknown) =>
  String(id).startsWith(COMPONENT_ID) ? String(id).slice(COMPONENT_ID.length) : undefined;

export const COMPONENT_ID = "component-";
