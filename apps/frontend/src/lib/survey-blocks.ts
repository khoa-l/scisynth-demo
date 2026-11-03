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
}

interface MarkerBlock<Type> {
  id: string;
  type: Type;
}

export type SurveyBlock =
  | ContentBlock
  | ChartBlock
  | MarkerBlock<"separator">
  | MarkerBlock<"page">
  | MarkerBlock<"end">;

export const blockLabels: Record<SurveyBlock["type"], string> = {
  text: "Text",
  scale: "Number scale",
  chart: "Chart",
  separator: "Separator",
  page: "New page",
  end: "End of survey",
};

export const blockTemplates: SurveyBlock[] = [
  { id: "text", type: "text", text: "" },
  { id: "scale", type: "scale", text: "" },
  { id: "chart", type: "chart", text: "", appearance: "shown", source: null },
  { id: "separator", type: "separator" },
  { id: "page", type: "page" },
  { id: "end", type: "end" },
];

export const SCALE_POINTS = [1, 2, 3, 4, 5];

export function cloneBlock(block: SurveyBlock): SurveyBlock {
  return { ...block, id: crypto.randomUUID() };
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

function isBlock(value: unknown): value is SurveyBlock {
  if (typeof value !== "object" || value === null) return false;
  if (!("id" in value) || typeof value.id !== "string" || !("type" in value)) return false;
  if (value.type === "separator" || value.type === "page" || value.type === "end") return true;
  if (!("text" in value) || typeof value.text !== "string") return false;
  if (value.type === "text" || value.type === "scale") return true;
  return (
    value.type === "chart" &&
    "appearance" in value &&
    (value.appearance === "shown" || value.appearance === "blank") &&
    "source" in value &&
    (value.source === null || isChartSource(value.source))
  );
}

export function surveyBlocks(content: { [key: string]: unknown }): SurveyBlock[] {
  return Array.isArray(content.blocks) ? content.blocks.filter(isBlock) : [];
}
