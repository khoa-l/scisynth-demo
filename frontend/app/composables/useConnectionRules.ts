import { useVueFlow } from "@vue-flow/core";

interface ConnectionLike {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

// Which connections the canvas allows, and what making one replaces.
//
// Outside a list, defects connected one to the next form a chain, an ordered list of stages. To
// stay a list it may not loop back on itself, and a defect has one successor (but may also feed a
// Preview). Inside a container the list sets the connections instead (useContainers): the links
// between neighbors are made by it, never by hand, and an item's side output only feeds a Preview.
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

  // The list's own vertical link ("next" to "prev"): only between a container's sampler or defect and
  // a defect in the same container.
  // VueFlow runs the validity check for connections added by code too, so the list's links pass
  // through here; the handles cannot be dragged from, so nothing else can ask for them.
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

  // Only connections that an input accepts are allowed (a defect into a Preview or another defect,
  // a Domain into a GaussianField's domain, a field into an Observer's latent input, ...)
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

  // An input takes one connection, so a new one replaces the old; a defect also has just one
  // successor in its chain
  onConnect((c) => {
    const sameInput = (e: ConnectionLike) =>
      e.target === c.target && (e.targetHandle ?? null) === (c.targetHandle ?? null);
    const nextInChain = (e: ConnectionLike) =>
      e.source === c.source && isDefect(c.target) && isDefect(e.target);
    removeEdges(edges.value.filter((e) => sameInput(e) || nextInChain(e)).map((e) => e.id));
    addEdges(c);
  });

  return { isValidConnection };
}
