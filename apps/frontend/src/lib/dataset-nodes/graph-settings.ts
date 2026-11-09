import { ConnectionLineType } from "@vue-flow/core";

export const GRAPH_SETTINGS_ID = "graph-settings";

export const LINE_TYPES = [
  ConnectionLineType.Bezier,
  ConnectionLineType.SmoothStep,
  ConnectionLineType.Step,
  ConnectionLineType.Straight,
] as const;

export type LineType = (typeof LINE_TYPES)[number];
