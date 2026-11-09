import type { DomainAxis } from "@/client";

export interface NodeCatalog {
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
  family: string;
  inputs: PortDef[];
  outputs: PortDef[];
  params: Record<string, ParamDef>;
}

type PortType = "field" | "observation" | "domain";

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

interface BooleanParam extends BaseParam {
  type: "boolean";
  default: boolean;
}

interface AxesParam extends BaseParam {
  type: "axes";
  default: DomainAxis[];
  max: number;
}

export type ParamDef = NumberParam | IntegerParam | EnumParam | BooleanParam | AxesParam;

export type ParamValue = boolean | number | string | DomainAxis[] | null;

export type ParamValues = Record<string, ParamValue>;
