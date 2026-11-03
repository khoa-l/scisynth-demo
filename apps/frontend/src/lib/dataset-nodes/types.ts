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
  name: string;
  label: string;
  category: string;
  group: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: Record<string, ParamDef>;
}

type PortType = "field" | "observation";

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
  multiple?: boolean;
  min?: number;
}

interface BaseParam {
  label: string;
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
