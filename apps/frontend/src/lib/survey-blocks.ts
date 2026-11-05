export const SURVEY_BLOCK_GROUP = "survey-blocks";

export const TASK_BLOCK = "survey-task-block";

export const surveyColumnClass = "mx-auto w-full max-w-2xl";

export interface ContentBlock {
  id: string;
  type: "text" | "scale";
  text: string;
}

export interface ChartSource {
  dataset_id: string;
  node_id: string;
  channels: number[];
}

export interface ChartBlock {
  id: string;
  type: "chart";
  text: string;
  appearance: "shown" | "blank";
  source: ChartSource | null;
  has_chart?: boolean;
}

export interface SurveyLabel {
  id: string;
  name: string;
  color: string;
}

export const LABEL_TOOLS = ["point", "lasso", "brush"] as const;

export type LabelTool = (typeof LABEL_TOOLS)[number];

export interface LabelBlock extends Omit<ChartBlock, "type"> {
  type: "label";
  labels: SurveyLabel[];
  tools: LabelTool[];
}

interface MarkerBlock<Type> {
  id: string;
  type: Type;
}

export type SurveyBlock =
  | ContentBlock
  | ChartBlock
  | LabelBlock
  | MarkerBlock<"separator">
  | MarkerBlock<"page">
  | MarkerBlock<"end">;

export type LabeledPoints = Record<string, number[]>;

export type Answers = Record<string, number | LabeledPoints>;

export const LABEL_COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];

export const blockLabels: Record<SurveyBlock["type"], string> = {
  text: "Text",
  scale: "Number scale",
  chart: "Chart",
  label: "Labeling",
  separator: "Separator",
  page: "New page",
  end: "End of survey",
};

export const blockHues: Record<SurveyBlock["type"], number> = {
  text: 250,
  scale: 250,
  chart: 170,
  label: 170,
  separator: 75,
  page: 75,
  end: 75,
};

export const blockTemplates: SurveyBlock[] = [
  { id: "text", type: "text", text: "" },
  { id: "scale", type: "scale", text: "" },
  { id: "chart", type: "chart", text: "", appearance: "shown", source: null },
  {
    id: "label",
    type: "label",
    text: "",
    appearance: "shown",
    source: null,
    labels: [{ id: "label-1", name: "Label 1", color: LABEL_COLORS[0]! }],
    tools: [...LABEL_TOOLS],
  },
  { id: "separator", type: "separator" },
  { id: "page", type: "page" },
  { id: "end", type: "end" },
];

export const SCALE_POINTS = [1, 2, 3, 4, 5];

export function cloneBlock(block: SurveyBlock): SurveyBlock {
  return { ...structuredClone(block), id: crypto.randomUUID() };
}

function isChartSource(value: unknown): value is ChartSource {
  return (
    typeof value === "object" &&
    value !== null &&
    "dataset_id" in value &&
    typeof value.dataset_id === "string" &&
    "node_id" in value &&
    typeof value.node_id === "string" &&
    "channels" in value &&
    Array.isArray(value.channels) &&
    value.channels.every(Number.isInteger)
  );
}

function isLabel(value: unknown): value is SurveyLabel {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "color" in value &&
    typeof value.color === "string"
  );
}

function isLabelTool(value: unknown): value is LabelTool {
  return LABEL_TOOLS.some((tool) => tool === value);
}

function isBlock(value: unknown): value is SurveyBlock {
  if (typeof value !== "object" || value === null) return false;
  if (!("id" in value) || typeof value.id !== "string" || !("type" in value)) return false;
  if (value.type === "separator" || value.type === "page" || value.type === "end") return true;
  if (!("text" in value) || typeof value.text !== "string") return false;
  if (value.type === "text" || value.type === "scale") return true;
  if (
    !("appearance" in value) ||
    (value.appearance !== "shown" && value.appearance !== "blank") ||
    !("source" in value) ||
    (value.source !== null && !isChartSource(value.source))
  ) {
    return false;
  }
  if (value.type === "chart") return true;
  return (
    value.type === "label" &&
    "labels" in value &&
    Array.isArray(value.labels) &&
    value.labels.every(isLabel) &&
    "tools" in value &&
    Array.isArray(value.tools) &&
    value.tools.every(isLabelTool)
  );
}

export function isAnswer(value: unknown): value is number | LabeledPoints {
  if (typeof value === "number") return true;
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(
      (indices) => Array.isArray(indices) && indices.every(Number.isInteger),
    )
  );
}

export function surveyBlocks(content: { [key: string]: unknown }): SurveyBlock[] {
  return Array.isArray(content.blocks) ? content.blocks.filter(isBlock) : [];
}
