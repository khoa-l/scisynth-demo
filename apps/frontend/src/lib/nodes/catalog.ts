import { queryOptions } from "@tanstack/vue-query";

import { localCatalog } from "./local-catalog";
import type { NodeCatalog, NodeKindDef, ParamValues } from "./types";

export const NODE_KIND_MIME = "application/x-scisynth-node";

/**
 * The only way the app reads the node catalogue. To serve it from the backend, fetch
 * it here (e.g. `GET /api/node-kinds`); nothing else needs to change.
 */
export const nodeCatalogQuery = queryOptions({
  queryKey: ["node-catalog"],
  queryFn: async (): Promise<NodeCatalog> => localCatalog,
  staleTime: Infinity,
});

/** What a node on the canvas holds: its kind's name and its parameter values. */
export interface CatalogNodeData {
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

/** Whether an output port of one kind can feed an input port of another. */
export function canConnect(catalog: NodeCatalog, link: Link): boolean {
  const source = findKind(catalog, link.sourceKind)?.outputs.find((p) => p.id === link.sourcePort);
  const target = findKind(catalog, link.targetKind)?.inputs.find((p) => p.id === link.targetPort);
  return !!source && !!target && source.type === target.type;
}
