const groupHues: Record<string, number> = {
  latent: 250,
  composite: 300,
  sampler: 170,
  defect: 25,
  transform: 75,
  projection: 340,
};

export function hueBackground(hue: number) {
  return `linear-gradient(135deg, oklch(0.9 0.07 ${hue}), oklch(0.84 0.09 ${hue}))`;
}

export function groupBackground(group: string) {
  const hue = groupHues[group];
  return hue === undefined ? undefined : hueBackground(hue);
}
