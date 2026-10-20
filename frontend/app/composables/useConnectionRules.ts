import { useVueFlow } from "@vue-flow/core";

interface ConnectionLike {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

// Which connections the canvas allows, and what making one replaces.
//
// Outside a container, defects form a chain: no loops, one successor each (and they may also feed a
// Preview). Inside one, the list makes the links (useContainers), never by hand.
export function useConnectionRules() {
  const { edges, findNode, onConnect, addEdges, removeEdges } = useVueFlow(FLOW_ID);

  const isDefect = (id: string) => isDefectKind(findNode(id)?.data?.type);
  const isContained = (id: string) => !!findNode(id)?.parentNode;

  function leadsTo(from: string, to: string): boolean {
    if (from === to) return true;
    return edges.value.some(
      (e) => e.source === from && isDefect(e.target) && leadsTo(e.target, to),
    );
  }

  // The list's own link ("next" to "prev"): between a container's sampler or defect and a defect in
  // the same container. VueFlow validates code-added connections too, so they pass through here.
  function isListLink(c: ConnectionLike) {
    const parent = findNode(c.source)?.parentNode;
    return (
      c.sourceHandle === "next" &&
      c.targetHandle === "prev" &&
      !!parent &&
      parent === findNode(c.target)?.parentNode &&
      isDefect(c.target)
    );
  }

  // Only what an input accepts
  function isValidConnection(c: ConnectionLike) {
    if (c.sourceHandle === "next" || c.targetHandle === "prev") return isListLink(c);
    if (isDefect(c.target) && isContained(c.source)) return false;
    const accepted = canConnect(
      findNode(c.source)?.data?.type,
      findNode(c.target)?.data?.type,
      c.targetHandle,
    );
    const loops = isDefect(c.source) && isDefect(c.target) && leadsTo(c.target, c.source);
    return accepted && !loops;
  }

  // An input takes one connection (unless it is a `multiple` port), so a new one replaces the old; a
  // defect has one successor
  onConnect((c) => {
    const multiple = kindOf(findNode(c.target)?.data?.type).ports?.find(
      (p) => p.id === c.targetHandle,
    )?.multiple;
    const sameInput = (e: ConnectionLike) =>
      !multiple && e.target === c.target && (e.targetHandle ?? null) === (c.targetHandle ?? null);
    const nextInChain = (e: ConnectionLike) =>
      e.source === c.source && isDefect(c.target) && isDefect(e.target);
    removeEdges(edges.value.filter((e) => sameInput(e) || nextInChain(e)).map((e) => e.id));
    addEdges(c);
  });

  return { isValidConnection };
}
