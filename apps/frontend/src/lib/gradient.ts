const GOLDEN_ANGLE = 137.508;

export function projectGradient(id: number): string {
  const hue = (id * GOLDEN_ANGLE) % 360;
  const hue2 = (hue + 60) % 360;
  return `linear-gradient(135deg, oklch(0.85 0.12 ${hue}), oklch(0.7 0.15 ${hue2}))`;
}
