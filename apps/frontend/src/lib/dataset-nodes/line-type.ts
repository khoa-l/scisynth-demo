import { ConnectionLineType } from "@vue-flow/core";

export const LINE_TYPES = [
  ConnectionLineType.Bezier,
  ConnectionLineType.SmoothStep,
  ConnectionLineType.Step,
  ConnectionLineType.Straight,
] as const;

export type LineType = (typeof LINE_TYPES)[number];
