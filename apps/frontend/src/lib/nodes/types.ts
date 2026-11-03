/**
 * The node catalogue contract. Everything here is plain JSON, so the same shape can
 * later be served by the backend (derived from the scisynth registry) instead of
 * `local-catalog.ts`.
 */

export interface NodeCatalog {
  version: 1;
  categories: NodeCategory[];
  kinds: NodeKindDef[];
}

interface NodeCategory {
  id: string;
  label: string;
}

export interface NodeKindDef {
  /** Stable id: the scisynth registry (class) name, e.g. "GaussianNoise". */
  name: string;
  label: string;
  /** A `NodeCategory.id`. */
  category: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: Record<string, ParamDef>;
}

/** What flows along an edge: a latent field, or an observation made from one. */
type PortType = "field" | "observation";

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
  /** Whether the port takes several edges (e.g. the terms of a Sum). */
  multiple?: boolean;
}

interface BaseParam {
  label: string;
  /** A blank value is allowed and means "not set" (null). */
  optional?: boolean;
}

export interface NumberParam extends BaseParam {
  type: "number";
  default: number | null;
  min?: number;
  max?: number;
  step?: number;
}

export interface IntegerParam extends BaseParam {
  type: "integer";
  default: number;
  min?: number;
  max?: number;
}

interface EnumParam extends BaseParam {
  type: "enum";
  default: string;
  options: { value: string; label: string }[];
}

export type ParamDef = NumberParam | IntegerParam | EnumParam;

export type ParamValue = number | string | null;

export type ParamValues = Record<string, ParamValue>;
