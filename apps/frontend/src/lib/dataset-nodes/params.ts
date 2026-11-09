import type { ParamDef, ParamValue } from "./types";

function isValidAxis(axis: unknown) {
  if (typeof axis !== "object" || axis === null) return false;
  const { name, extent } = axis as { name?: unknown; extent?: unknown };
  return (
    typeof name === "string" &&
    name.trim() !== "" &&
    Array.isArray(extent) &&
    extent.length === 2 &&
    extent.every(Number.isFinite) &&
    extent[0] < extent[1]
  );
}

export function isValidParam(def: ParamDef, value: unknown): value is ParamValue {
  if (value === null) return !!def.optional;
  if (def.type === "axes") {
    return (
      Array.isArray(value) &&
      value.length >= 1 &&
      value.length <= def.max &&
      value.every(isValidAxis) &&
      new Set(value.map((axis) => axis.name)).size === value.length
    );
  }
  if (def.type === "enum") return def.options.some((option) => option.value === value);
  if (def.type === "boolean") return typeof value === "boolean";
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (def.type === "integer" && !Number.isInteger(value)) return false;
  return value >= (def.min ?? -Infinity) && value <= (def.max ?? Infinity);
}
