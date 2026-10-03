// The zone of a container (an Observer) that something being dragged would land in, or null. Set
// while dragging a node over it, so the zone can light up.
export const useHoverContainer = () =>
  useState<{ id: string; zone: string } | null>("hover-container", () => null);
