// The components that can be dragged into a task's list, and the data each one keeps
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

// A copy of a source (a Data, Plot or Preview node of the workflow) a component shows. The request
// is kept with the component, so it keeps showing the same data when the workflow changes, until it
// is refreshed.
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
  interactive: boolean; // zoom, pan and hover; off, a still picture
  colors: boolean; // as the source colors its points; off, one color
}
export interface ClusterData {
  source?: SourceSnapshot; // an Observer
  x?: string; // the columns plotted
  y?: string;
  color?: string; // the column the points are colored by, in groups of number ranges...
  breaks?: number[]; // ...where one range ends and the next begins, in order
  names?: string[]; // what each range is called (by its place; empty: the range, "2 ≤ value < 5")
  showNoValue?: boolean; // plot the points with no value to color by (off: left out)
}
export type ComponentData = TextData | TableData | PlotData | ClusterData;

// A component placed in a task's list (the same type can be placed more than once)
export interface PlacedComponent {
  uid: number;
  type: string;
  data: ComponentData;
}

// What a newly placed component starts with
export function initialData(type: string): ComponentData {
  if (type === "text") return { text: "" };
  if (type === "plot") return { interactive: true, colors: true };
  return {};
}

export const taskComponentOf = (type: string) =>
  TASK_COMPONENTS.find((c) => c.type === type) ?? TASK_COMPONENTS[0]!;

// The type of the component a drag started on in the sidebar (its draggable id), if it is one
export const componentTypeOf = (id: unknown) =>
  String(id).startsWith(COMPONENT_ID) ? String(id).slice(COMPONENT_ID.length) : undefined;

export const COMPONENT_ID = "component-";
