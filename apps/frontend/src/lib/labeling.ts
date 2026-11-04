import type { NodePreview, TypedArray } from "@/client";
import type { LabeledPoints } from "@/lib/survey-blocks";

export interface Location {
  index: number;
  x: number;
  y: number;
}

export interface Pixel {
  x: number;
  y: number;
}

export interface PlacedLocation {
  index: number;
  at: Pixel;
}

export function decode({ bdata }: TypedArray): Float32Array {
  const bytes = Uint8Array.from(atob(bdata), (char) => char.charCodeAt(0));
  return new Float32Array(bytes.buffer);
}

export function locations(preview: NodePreview): Location[] {
  const [x, y] = [decode(preview.x), decode(preview.y)];
  const channels = preview.channels.map(decode);
  const present = (index: number) => channels.some((values) => Number.isFinite(values[index]));
  const found: Location[] = [];
  if (preview.layout === "grid") {
    y.forEach((rowY, row) => {
      x.forEach((colX, col) => {
        const index = row * x.length + col;
        if (present(index)) found.push({ index, x: colX, y: rowY });
      });
    });
  } else {
    x.forEach((pointX, index) => {
      const pointY = y[index]!;
      if (present(index) && Number.isFinite(pointX) && Number.isFinite(pointY)) {
        found.push({ index, x: pointX, y: pointY });
      }
    });
  }
  return found;
}

export function nearest(points: PlacedLocation[], to: Pixel, radius: number): number[] {
  let closest: PlacedLocation | undefined;
  let closestDistance = radius;
  for (const point of points) {
    const distance = Math.hypot(point.at.x - to.x, point.at.y - to.y);
    if (distance <= closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  }
  return closest ? [closest.index] : [];
}

function distanceToSegment(point: Pixel, from: Pixel, to: Pixel): number {
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length))
    : 0;
  return Math.hypot(point.x - (from.x + t * dx), point.y - (from.y + t * dy));
}

export function brushed(
  points: PlacedLocation[],
  from: Pixel,
  to: Pixel,
  radius: number,
): number[] {
  return points
    .filter((point) => distanceToSegment(point.at, from, to) <= radius)
    .map((point) => point.index);
}

function isInside(point: Pixel, outline: Pixel[]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [a, b] = [outline[i]!, outline[j]!];
    if (a.y > point.y !== b.y > point.y) {
      const crossing = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < crossing) inside = !inside;
    }
  }
  return inside;
}

export function lassoed(points: PlacedLocation[], outline: Pixel[]): number[] {
  return points.filter((point) => isInside(point.at, outline)).map((point) => point.index);
}

export function setLabel(
  labeled: LabeledPoints,
  labelId: string,
  indices: number[],
): LabeledPoints {
  const others = eraseLabels(labeled, indices);
  const merged = new Set([...(others[labelId] ?? []), ...indices]);
  return { ...others, [labelId]: [...merged].sort((a, b) => a - b) };
}

export function eraseLabels(labeled: LabeledPoints, indices: number[]): LabeledPoints {
  const erased = new Set(indices);
  const kept: LabeledPoints = {};
  for (const [labelId, labelIndices] of Object.entries(labeled)) {
    const remaining = labelIndices.filter((index) => !erased.has(index));
    if (remaining.length) kept[labelId] = remaining;
  }
  return kept;
}
