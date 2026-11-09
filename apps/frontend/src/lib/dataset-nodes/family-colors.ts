import { hueBackground } from "@/lib/gradient";

export const familyHues: Record<string, number> = {
  latent: 250,
  composite: 300,
  sampler: 170,
  defect: 25,
  transform: 75,
  projection: 340,
};

export function familyBackground(family: string) {
  const hue = familyHues[family];
  return hue === undefined ? undefined : hueBackground(hue);
}
