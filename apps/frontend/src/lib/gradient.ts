const GOLDEN_ANGLE = 137.508;
const HUE_SPREAD = 60;

function baseHue(id: number): number {
  return (id * GOLDEN_ANGLE) % 360;
}

export function projectGradient(id: number): string {
  const hue = baseHue(id);
  const hue2 = (hue + HUE_SPREAD) % 360;
  return `linear-gradient(135deg, oklch(0.85 0.12 ${hue}), oklch(0.7 0.15 ${hue2}))`;
}

export function projectTextColor(id: number): string {
  const midHue = (baseHue(id) + HUE_SPREAD / 2) % 360;
  return `oklch(0.95 0.06 ${midHue})`;
}
