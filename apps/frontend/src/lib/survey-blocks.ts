export const SURVEY_BLOCK_GROUP = "survey-blocks";

export const TASK_BLOCK = "survey-task-block";

export const surveyColumnClass = "mx-auto w-full max-w-2xl";

export interface ContentBlock {
  id: string;
  type: "text" | "scale";
  text: string;
}

interface MarkerBlock<Type> {
  id: string;
  type: Type;
}

export type SurveyBlock =
  | ContentBlock
  | MarkerBlock<"separator">
  | MarkerBlock<"page">
  | MarkerBlock<"end">;

export const blockLabels: Record<SurveyBlock["type"], string> = {
  text: "Text",
  scale: "Number scale",
  separator: "Separator",
  page: "New page",
  end: "End of survey",
};

export const blockTemplates: SurveyBlock[] = [
  { id: "text", type: "text", text: "" },
  { id: "scale", type: "scale", text: "" },
  { id: "separator", type: "separator" },
  { id: "page", type: "page" },
  { id: "end", type: "end" },
];

export const SCALE_POINTS = [1, 2, 3, 4, 5];

export function cloneBlock(block: SurveyBlock): SurveyBlock {
  return { ...block, id: crypto.randomUUID() };
}

function isBlock(value: unknown): value is SurveyBlock {
  if (typeof value !== "object" || value === null) return false;
  if (!("id" in value) || typeof value.id !== "string" || !("type" in value)) return false;
  if (value.type === "separator" || value.type === "page" || value.type === "end") return true;
  return (
    (value.type === "text" || value.type === "scale") &&
    "text" in value &&
    typeof value.text === "string"
  );
}

export function surveyBlocks(content: { [key: string]: unknown }): SurveyBlock[] {
  return Array.isArray(content.blocks) ? content.blocks.filter(isBlock) : [];
}
