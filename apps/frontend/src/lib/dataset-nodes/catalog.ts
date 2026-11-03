import { queryOptions } from "@tanstack/vue-query";

import { localCatalog } from "./local-catalog";
import type { NodeCatalog, NodeKindDef, ParamValues } from "./types";

export const NODE_KIND_MIME = "application/x-scisynth-node";

export const nodeCatalogQuery = queryOptions({
  queryKey: ["node-catalog"],
  queryFn: async (): Promise<NodeCatalog> => localCatalog,
  staleTime: Infinity,
});

export interface DatasetNodeData {
  kind: string;
  params: ParamValues;
}

export function findKind(catalog: NodeCatalog, name: string): NodeKindDef | undefined {
  return catalog.kinds.find((kind) => kind.name === name);
}

export function defaultParams(kind: NodeKindDef): ParamValues {
  return Object.fromEntries(Object.entries(kind.params).map(([name, def]) => [name, def.default]));
}

interface Link {
  sourceKind: string;
  sourcePort?: string | null;
  targetKind: string;
  targetPort?: string | null;
}

export function canConnect(catalog: NodeCatalog, link: Link): boolean {
  const sourceKind = findKind(catalog, link.sourceKind);
  const targetKind = findKind(catalog, link.targetKind);
  if (!sourceKind || !targetKind) return true;
  const source = sourceKind.outputs.find((p) => p.id === link.sourcePort);
  const target = targetKind.inputs.find((p) => p.id === link.targetPort);
  return !!source && !!target && source.type === target.type;
}
