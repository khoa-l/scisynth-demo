type NodeShape = "input" | "default" | "output";

interface NodeKind {
  name: string;
  label: string;
  type: NodeShape;
}

interface NodeCategory {
  label: string;
  kinds: NodeKind[];
}

function kinds(type: NodeShape, entries: [name: string, label: string][]): NodeKind[] {
  return entries.map(([name, label]) => ({ name, label, type }));
}

export const nodeCategories: NodeCategory[] = [
  {
    label: "Latent",
    kinds: [
      ...kinds("input", [
        ["GaussianField", "Gaussian field"],
        ["AnalyticField", "Analytic field"],
        ["InterpolatedField", "Interpolated field"],
      ]),
      ...kinds("default", [
        ["Sum", "Sum"],
        ["Product", "Product"],
        ["Multichannel", "Multichannel"],
      ]),
    ],
  },
  {
    label: "Sampler",
    kinds: kinds("default", [
      ["GridSampler", "Grid sampler"],
      ["PointSampler", "Point sampler"],
    ]),
  },
  {
    label: "Stages",
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
      ["Downsample", "Downsample"],
    ]),
  },
  {
    label: "Projection",
    kinds: kinds("output", [["Projection", "Projection"]]),
  },
];

export const NODE_KIND_MIME = "application/x-scisynth-node";

export function findNodeKind(name: string): NodeKind | undefined {
  return nodeCategories.flatMap((category) => category.kinds).find((kind) => kind.name === name);
}
