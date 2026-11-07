import { hueBackground } from "@/lib/gradient";

export const groupHues: Record<string, number> = {
  latent: 250,
  composite: 300,
  sampler: 170,
  defect: 25,
  transform: 75,
  projection: 340,
};

export function groupBackground(group: string) {
  const hue = groupHues[group];
  return hue === undefined ? undefined : hueBackground(hue);
}
