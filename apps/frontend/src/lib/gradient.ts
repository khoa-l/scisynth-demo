const GOLDEN_ANGLE = 137.508;
const HUE_SPREAD = 60;

function toNumber(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function baseHue(id: string): number {
  return (toNumber(id) * GOLDEN_ANGLE) % 360;
}

export function itemGradient(id: string): string {
  const hue = baseHue(id);
  const hue2 = (hue + HUE_SPREAD) % 360;
  return `linear-gradient(135deg, oklch(0.85 0.12 ${hue}), oklch(0.7 0.15 ${hue2}))`;
}

export function itemTextColor(id: string): string {
  const midHue = (baseHue(id) + HUE_SPREAD / 2) % 360;
  return `oklch(0.95 0.06 ${midHue})`;
}
