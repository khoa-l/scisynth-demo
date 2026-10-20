import type { GraphNode } from "@vue-flow/core";

// How a container (the Observer) stacks its children in its zones; its own height comes from the
// same numbers, so the drawn areas and the nodes agree.

export const CONTAINER = {
  inset: 8, // between the container's edge and a zone, and between zones
  pad: 8, // inside a zone, around its nodes
  itemGap: 16, // between nodes in a zone, room for the link between them
};

export interface LayoutItem {
  id: string;
  type: string;
  height: number; // measured, or an estimate until then
}

export interface ZoneBox {
  zone: Zone;
  left: number;
  top: number;
  width: number;
  height: number;
  members: string[]; // node ids, top to bottom
}

// Connected nodes in order: each chain starts at a node nothing feeds, then follows its successors.
// Others keep the order they were added in.
export function chainOrder(ids: string[], edges: { source: string; target: string }[]) {
  const inSet = new Set(ids);
  const next = new Map<string, string>();
  const hasPrev = new Set<string>();
  for (const e of edges) {
    if (!inSet.has(e.source) || !inSet.has(e.target)) continue;
    next.set(e.source, e.target);
    hasPrev.add(e.target);
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (hasPrev.has(id)) continue;
    for (let cur: string | undefined = id; cur && !seen.has(cur); cur = next.get(cur)) {
      seen.add(cur);
      out.push(cur);
    }
  }
  return [...out, ...ids.filter((id) => !seen.has(id))]; // the rest are in a loop
}

// The zones of `kind` (as boxes from the node's top-left) and where each child goes; `items` are
// in the order they were added.
export function containerLayout(
  kind: NodeKind,
  items: LayoutItem[],
  edges: { source: string; target: string }[],
) {
  const width = nodeWidth(kind);
  const left = 1 + CONTAINER.inset; // the card's border
  const zoneWidth = width - 2 - CONTAINER.inset * 2;
  const bodyTop = HEADER_HEIGHT + containerTopHeight(kind);
  const positions = new Map<string, { x: number; y: number }>();
  const zones: ZoneBox[] = [];
  const unplaced: string[] = [];

  let y = bodyTop + CONTAINER.inset;
  for (const zone of kind.zones ?? []) {
    let members = items.filter((i) => zoneFor(kind, i.type)?.id === zone.id);
    if (zone.ordered) {
      const order = chainOrder(
        members.map((m) => m.id),
        edges,
      );
      members = order.map((id) => members.find((m) => m.id === id)!);
    }
    if (zone.max && members.length > zone.max) {
      unplaced.push(...members.slice(zone.max).map((m) => m.id));
      members = members.slice(0, zone.max);
    }
    let cursor = y + CONTAINER.pad;
    for (const m of members) {
      const childWidth = nodeWidth(kindOf(m.type));
      positions.set(m.id, { x: left + (zoneWidth - childWidth) / 2, y: cursor });
      cursor += m.height + CONTAINER.itemGap;
    }
    const content = members.length ? cursor - CONTAINER.itemGap + CONTAINER.pad - y : 0;
    const height = Math.max(zone.minHeight, content);
    zones.push({
      zone,
      left,
      top: y,
      width: zoneWidth,
      height,
      members: members.map((m) => m.id),
    });
    y += height + CONTAINER.inset;
  }
  return { zones, positions, unplaced, bodyHeight: y - bodyTop };
}

// A node's height, measured or estimated
export const heightOf = (node: Pick<GraphNode, "dimensions">) =>
  node.dimensions.height || NODE_SIZE.height;

// The layout of a container from the nodes whose parent it is
export function layoutFor(
  container: Pick<GraphNode, "id" | "data">,
  nodes: GraphNode[],
  edges: { source: string; target: string }[],
) {
  return containerLayout(
    kindOf(container.data?.type),
    nodes
      .filter((n) => n.parentNode === container.id)
      .map((n) => ({ id: n.id, type: n.data?.type, height: heightOf(n) })),
    edges,
  );
}
