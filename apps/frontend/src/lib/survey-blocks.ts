export const SURVEY_BLOCK_GROUP = "survey-blocks";

export const TASK_BLOCK = "survey-task-block";

interface TextBlock {
  id: string;
  type: "text";
  text: string;
}

export type SurveyBlock = TextBlock;

export const blockLabels: Record<SurveyBlock["type"], string> = { text: "Text" };

export const blockTemplates: SurveyBlock[] = [{ id: "text", type: "text", text: "" }];

export function cloneBlock(block: SurveyBlock): SurveyBlock {
  return { ...block, id: crypto.randomUUID() };
}

function isBlock(value: unknown): value is SurveyBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "text" &&
    "id" in value &&
    typeof value.id === "string" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

export function surveyBlocks(content: { [key: string]: unknown }): SurveyBlock[] {
  return Array.isArray(content.blocks) ? content.blocks.filter(isBlock) : [];
}
