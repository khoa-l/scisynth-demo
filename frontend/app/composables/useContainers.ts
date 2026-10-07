import { useVueFlow, type GraphNode } from "@vue-flow/core";

type Point = { x: number; y: number };
export type ZoneHit = { container: GraphNode; zone: Zone };

// Containers (the Observer) have zones that take nodes: the sampler zone takes one sampler, the
// stages zone is a list of defects. A node in a zone is a child of the container, but its place is
// not free: the container stacks its children (containerLayout), and it grows with them.
//
// The order of an ordered zone (the stages) is what sets the connections: each item is connected to
// the next by a vertical link (bottom handle "next" to top handle "prev"), and the sampler, if there
// is one, heads the chain. So putting an item in the list breaks the item's other connections into
// a defect and connects it to its neighbors, taking it out joins the neighbors, and reordering the
// list rewires it. A connection to a Preview is never touched.
export function useContainers() {
  const {
    nodes,
    edges,
    findNode,
    updateNode,
    addEdges,
    removeEdges,
    removeNodes,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  } = useVueFlow(FLOW_ID);

  const hover = useHoverContainer();
  const dragging = ref<string>(); // the node under the pointer: the layout leaves it alone

  const isDefect = (id: string) => isDefectKind(findNode(id)?.data?.type);
  const childrenOf = (container: GraphNode) =>
    nodes.value.filter((n) => n.parentNode === container.id);
  const layoutOf = (container: GraphNode) => layoutFor(container, nodes.value, edges.value);
  const orderedZone = (container: GraphNode) =>
    kindOf(container.data?.type).zones?.find((z) => z.ordered);

  // ---- finding a zone

  // The zone (and its container) that a node of `childType` would land in at `point`; `self` is the
  // node being moved, which does not count against a zone's capacity
  function zoneAt(point: Point, childType: string | undefined, self?: string): ZoneHit | undefined {
    let found: ZoneHit | undefined;
    for (const container of nodes.value) {
      const kind = kindOf(container.data?.type);
      const zone = kind.zones && container.dimensions.width ? zoneFor(kind, childType) : undefined;
      if (!zone || container.id === self) continue;
      const box = layoutOf(container).zones.find((b) => b.zone.id === zone.id)!;
      const x = container.computedPosition.x + box.left;
      const y = container.computedPosition.y + box.top;
      const over =
        point.x >= x && point.x <= x + box.width && point.y >= y && point.y <= y + box.height;
      const taken = box.members.filter((id) => id !== self).length;
      if (over && (!zone.max || taken < zone.max)) found = { container, zone }; // later nodes are on top
    }
    return found;
  }

  // Light up the zone being dragged over (or none)
  const showHover = (hit?: ZoneHit) => {
    hover.value = hit ? { id: hit.container.id, zone: hit.zone.id } : null;
  };

  // ---- the list's order and its connections

  // The order each list was last given. The links between neighbors are what is saved, but they go
  // when an item does (deleting a node removes its links), so when an item leaves, the order that
  // is left is this one without it, not whatever the surviving links happen to say.
  const knownOrder = new Map<string, string[]>();

  // the items of the ordered zone, top to bottom, as the connections order them
  const listOf = (container: GraphNode) =>
    layoutOf(container).zones.find((b) => b.zone.id === orderedZone(container)?.id)?.members ?? [];

  function orderWithout(container: GraphNode, gone?: string) {
    const members = new Set(childrenOf(container).map((n) => n.id));
    const kept = (knownOrder.get(container.id) ?? []).filter(
      (id) => id !== gone && members.has(id),
    );
    // anything not known yet (a loaded study, a new item) follows, in the order its links give
    return [...kept, ...listOf(container).filter((id) => id !== gone && !kept.includes(id))];
  }

  // where `y` falls among the items of the list (not counting `self`): the index it would take
  function indexAt(container: GraphNode, y: number, self?: string) {
    return listOf(container)
      .filter((id) => id !== self)
      .filter((id) => {
        const n = findNode(id);
        return !!n && n.computedPosition.y + heightOf(n) / 2 < y;
      }).length;
  }

  const insertAt = (list: string[], id: string, index: number) => {
    const others = list.filter((x) => x !== id);
    return [...others.slice(0, index), id, ...others.slice(index)];
  };

  // the sampler: the node in the first zone that is not a list, which heads the chain
  const headOf = (container: GraphNode) =>
    layoutOf(container).zones.find((b) => !b.zone.ordered)?.members[0];

  // Make the connections match `order` (the stages, behind the sampler): each linked to the next,
  // every other connection into a defect of the items (from a defect or a sampler) broken
  function applyOrder(container: GraphNode, order: string[]) {
    knownOrder.set(container.id, order);
    const head = headOf(container);
    const chain = head ? [head, ...order] : order;
    const members = new Set(chain);
    const links = chain.slice(1).map((target, i) => ({
      id: `chain:${chain[i]}>${target}`, // the same neighbors keep the same connection
      source: chain[i]!,
      target,
      sourceHandle: "next",
      targetHandle: "prev",
      type: "straight",
    }));
    const keep = new Set(links.map((l) => l.id));
    const stale = edges.value.filter(
      (e) =>
        (members.has(e.source) || members.has(e.target)) && isDefect(e.target) && !keep.has(e.id),
    );
    if (stale.length) removeEdges(stale.map((e) => e.id));
    const present = new Set(edges.value.map((e) => e.id));
    const missing = links.filter((l) => !present.has(l.id));
    if (missing.length) addEdges(missing);
  }

  // Put `id` (already a child of the container) into the hit zone's list at height `y`
  function placeInList(hit: ZoneHit, id: string, y: number) {
    if (!hit.zone.ordered) return; // a sampler joins the chain when it becomes a child (see below)
    const order = insertAt(orderWithout(hit.container, id), id, indexAt(hit.container, y, id));
    applyOrder(hit.container, order);
  }

  // ---- keeping the canvas in line with the lists

  // Take a node out of its container, leaving it on the canvas where it is drawn (or at `at`)
  function eject(id: string, at?: Point) {
    const node = findNode(id);
    if (!node) return;
    const from = node.parentNode ? findNode(node.parentNode) : undefined;
    updateNode(id, { parentNode: undefined, position: at ?? { ...node.computedPosition } });
    // its neighbors in the list are joined to each other, and it loses its links to them
    if (from && orderedZone(from)) applyOrder(from, orderWithout(from, id));
  }

  function relayout(container: GraphNode) {
    const layout = layoutOf(container);
    for (const [id, position] of layout.positions) {
      if (id === dragging.value) continue; // it follows the pointer; it snaps into place on release
      const node = findNode(id);
      if (node && (node.position.x !== position.x || node.position.y !== position.y)) {
        updateNode(id, { position });
      }
    }
    // what a zone cannot take (a second sampler, from older data) goes back onto the canvas beside it
    for (const id of layout.unplaced) {
      eject(id, {
        x: container.computedPosition.x + nodeWidth(kindOf(container.data?.type)) + 24,
        y: container.computedPosition.y,
      });
    }
  }

  const containers = () => nodes.value.filter((n) => kindOf(n.data?.type).zones);

  // When what is in a list changes (an item removed, or an older study loaded) the connections
  // are brought in line with the order that is left
  watch(
    () =>
      containers()
        .map(
          (c) =>
            `${c.id}:${childrenOf(c)
              .map((n) => n.id)
              .join("+")}`,
        )
        .join(),
    () => {
      for (const id of knownOrder.keys()) if (!findNode(id)) knownOrder.delete(id);
      for (const c of containers()) if (orderedZone(c)) applyOrder(c, orderWithout(c));
      // a sampler placed in a container has no input, so nothing connected to it remains
      const placed = new Set(
        nodes.value.filter((n) => n.parentNode && !isDefect(n.id)).map((n) => n.id),
      );
      const loose = edges.value.filter((e) => placed.has(e.target));
      if (loose.length) removeEdges(loose.map((e) => e.id));
    },
    { flush: "post", immediate: true },
  );

  // The layout follows the children, their heights (known once measured, and when their fields
  // change), and the connections that set the list's order
  watch(
    () =>
      nodes.value
        .filter((n) => n.parentNode || kindOf(n.data?.type).zones)
        .map((n) => `${n.id}>${n.parentNode ?? ""}:${Math.round(n.dimensions.height)}`)
        .join() +
      "|" +
      edges.value.map((e) => `${e.source}>${e.target}`).join(),
    () => containers().forEach(relayout),
    { flush: "post", immediate: true },
  );

  // Deleting a container deletes what is inside it, however it was deleted
  watch(
    () => nodes.value.map((n) => `${n.id}>${n.parentNode ?? ""}`).join(),
    () => {
      const ids = new Set(nodes.value.map((n) => n.id));
      const orphans = nodes.value.filter((n) => n.parentNode && !ids.has(n.parentNode));
      if (orphans.length) removeNodes(orphans.map((n) => n.id));
    },
  );

  // A connection with a node inside a container is drawn above the container so it stays visible
  // across the container's body, but under the nodes inside. It takes the layer of the node inside
  // (a node is drawn over a connection on the same layer): normally 1 against the container's 0,
  // but VueFlow lifts a selected node by 1000 (the container too, and its children above it), so
  // the connection follows. Everything else stays at 0, under all nodes. Derived, not saved.
  watch(
    () =>
      nodes.value.map((n) => `${n.id}>${n.parentNode ?? ""}@${n.computedPosition.z}`).join() +
      "|" +
      edges.value.map((e) => `${e.id}:${e.source}:${e.target}`).join(),
    () => {
      const layerOf = (id: string) => {
        const node = findNode(id);
        return node?.parentNode ? node.computedPosition.z : 0;
      };
      for (const e of edges.value) {
        const z = Math.max(layerOf(e.source), layerOf(e.target));
        if ((e.zIndex ?? 0) !== z) e.zIndex = z;
      }
    },
    { immediate: true },
  );

  // ---- dragging nodes that are on the canvas
  //
  // Dragging a node over a zone that takes it lights the zone up; letting go there puts the node in
  // it (and snaps it back into its slot if it was already there), and letting go elsewhere takes it
  // out. The list is sortable: moving an item up or down it reorders the list as it passes its
  // neighbors, and the connections follow. Dragging a container moves what is inside it.

  const centerOf = (n: GraphNode): Point => ({
    x: n.computedPosition.x + n.dimensions.width / 2,
    y: n.computedPosition.y + n.dimensions.height / 2,
  });

  onNodeDragStart(({ node }) => {
    dragging.value = node.id;
  });

  onNodeDrag(({ node }) => {
    const center = centerOf(node);
    const hit = zoneAt(center, node.data?.type, node.id);
    showHover(hit);
    const parent = node.parentNode ? findNode(node.parentNode) : undefined;
    if (parent && hit && hit.container.id === parent.id && hit.zone.ordered) {
      const list = listOf(parent);
      const index = indexAt(parent, center.y, node.id);
      if (list.indexOf(node.id) !== index) applyOrder(parent, insertAt(list, node.id, index));
    }
  });

  onNodeDragStop(({ node }) => {
    dragging.value = undefined;
    showHover();
    const center = centerOf(node);
    const hit = zoneAt(center, node.data?.type, node.id);
    if (hit && hit.container.id === node.parentNode) {
      relayout(hit.container); // dropped inside its own zone: it snaps into its place in the list
    } else if (hit) {
      // moved into a zone; the container's layout sets its final place
      const abs = node.computedPosition;
      updateNode(node.id, {
        parentNode: hit.container.id,
        position: {
          x: abs.x - hit.container.computedPosition.x,
          y: abs.y - hit.container.computedPosition.y,
        },
      });
      placeInList(hit, node.id, center.y);
    } else if (node.parentNode) {
      eject(node.id);
    }
  });

  return { zoneAt, showHover, placeInList };
}
