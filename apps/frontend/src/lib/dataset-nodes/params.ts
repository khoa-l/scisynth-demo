import type { IntegerParam, NumberParam, ParamDef, ParamValue } from "./types";

export function isValidParam(def: ParamDef, value: unknown): value is ParamValue {
  if (value === null) return !!def.optional;
  if (def.type === "enum") return def.options.some((option) => option.value === value);
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (def.type === "integer" && !Number.isInteger(value)) return false;
  return value >= (def.min ?? -Infinity) && value <= (def.max ?? Infinity);
}

export function parseParam(def: NumberParam | IntegerParam, raw: string): ParamValue | undefined {
  const value = raw.trim() === "" ? null : Number(raw);
  return isValidParam(def, value) ? value : undefined;
}
