export type NodeShape = "input" | "default" | "output";

export interface NodeKind {
  name: string;
  label: string;
  type: NodeShape;
}

export interface NodeGroup {
  label?: string;
  kinds: NodeKind[];
}

export interface NodeCategory {
  label: string;
  groups: NodeGroup[];
}

function kinds(type: NodeShape, entries: [name: string, label: string][]): NodeKind[] {
  return entries.map(([name, label]) => ({ name, label, type }));
}

export const nodeCategories: NodeCategory[] = [
  {
    label: "Latent",
    groups: [
      {
        label: "Fields",
        kinds: kinds("input", [
          ["GaussianField", "Gaussian field"],
          ["AnalyticField", "Analytic field"],
          ["InterpolatedField", "Interpolated field"],
        ]),
      },
      {
        label: "Composites",
        kinds: kinds("default", [
          ["Sum", "Sum"],
          ["Product", "Product"],
          ["Multichannel", "Multichannel"],
        ]),
      },
    ],
  },
  {
    label: "Sampler",
    groups: [
      {
        kinds: kinds("default", [
          ["GridSampler", "Grid sampler"],
          ["PointSampler", "Point sampler"],
        ]),
      },
    ],
  },
  {
    label: "Stages",
    groups: [
      {
        label: "Defects",
        kinds: kinds("default", [
          ["GaussianNoise", "Gaussian noise"],
          ["PoissonNoise", "Poisson noise"],
          ["Quantize", "Quantize"],
          ["Clip", "Clip"],
          ["Saturate", "Saturate"],
          ["ValueOffset", "Value offset"],
          ["Gain", "Gain"],
          ["Drift", "Drift"],
          ["CoordinateShift", "Coordinate shift"],
          ["RandomDropout", "Random dropout"],
          ["PositionJitter", "Position jitter"],
          ["RandomInsertion", "Random insertion"],
        ]),
      },
      {
        label: "Transforms",
        kinds: kinds("default", [["Downsample", "Downsample"]]),
      },
    ],
  },
  {
    label: "Projection",
    groups: [{ kinds: kinds("output", [["Projection", "Projection"]]) }],
  },
];
