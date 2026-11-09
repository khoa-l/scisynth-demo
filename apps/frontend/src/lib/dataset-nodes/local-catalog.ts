import type { IntegerParam, NodeCatalog, NodeKindDef, NumberParam, PortDef } from "./types";

const field: PortDef = { id: "field", label: "Field", type: "field" };
const observation: PortDef = { id: "observation", label: "Observation", type: "observation" };
const latent: PortDef = { id: "latent", label: "Latent", type: "field" };
const fields = (id: string, label: string, min?: number): PortDef => ({
  id,
  label,
  type: "field",
  multiple: true,
  min,
});

const num = (
  label: string,
  value: number | null,
  extra: Pick<NumberParam, "min" | "max" | "step" | "optional"> = {},
): NumberParam => ({
  type: "number",
  label,
  default: value,
  ...extra,
});
const int = (
  label: string,
  value: number,
  extra: Pick<IntegerParam, "min" | "max"> = {},
): IntegerParam => ({
  type: "integer",
  label,
  default: value,
  ...extra,
});
const bound = (label: string) => num(label, null, { optional: true });

const seed = int("Seed", 0, { min: 0 });

function stage(family: string) {
  return (name: string, label: string, params: NodeKindDef["params"] = {}): NodeKindDef => ({
    name,
    label,
    category: "stage",
    family,
    inputs: [observation],
    outputs: [observation],
    params,
  });
}

const defect = stage("defect");
const transform = stage("transform");

function projection(name: string, label: string, params: NodeKindDef["params"]): NodeKindDef {
  return {
    name,
    label,
    category: "projection",
    family: "projection",
    inputs: [observation],
    outputs: [],
    params,
  };
}

export const localCatalog: NodeCatalog = {
  categories: [
    { id: "latent", label: "Latent" },
    { id: "sampler", label: "Sampler" },
    { id: "stage", label: "Stages" },
    { id: "projection", label: "Projection" },
  ],
  kinds: [
    {
      name: "GaussianField",
      label: "Gaussian Field",
      category: "latent",
      family: "latent",
      inputs: [],
      outputs: [field],
      params: {
        length_scale: num("Length scale", 0.1, { min: 0, step: 0.01 }),
        amplitude: num("Amplitude", 1),
        mean: num("Mean", 0),
        resolution: int("Resolution", 128, { min: 1 }),
        order: int("Spline order", 1, { min: 0, max: 5 }),
        seed,
      },
    },
    {
      name: "GaussianBumps",
      label: "Gaussian Bumps",
      category: "latent",
      family: "latent",
      inputs: [],
      outputs: [field],
      params: {
        count: int("Bumps", 10, { min: 0, max: 100 }),
        width: num("Width", 0.1, { min: 0, step: 0.01 }),
        height: num("Height", 1),
        seed,
      },
    },
    {
      name: "VoronoiRegions",
      label: "Voronoi Regions",
      category: "latent",
      family: "latent",
      inputs: [],
      outputs: [field],
      params: {
        count: int("Regions", 10, { min: 1, max: 10000 }),
        seed,
      },
    },
    {
      name: "Sum",
      label: "Sum",
      category: "latent",
      family: "composite",
      inputs: [fields("terms", "Terms", 2)],
      outputs: [field],
      params: {},
    },
    {
      name: "Product",
      label: "Product",
      category: "latent",
      family: "composite",
      inputs: [fields("terms", "Terms", 2)],
      outputs: [field],
      params: {},
    },
    {
      name: "Threshold",
      label: "Threshold",
      category: "latent",
      family: "composite",
      inputs: [field],
      outputs: [field],
      params: { level: num("Level", 0, { step: 0.1 }) },
    },
    {
      name: "Multichannel",
      label: "Multichannel",
      category: "latent",
      family: "composite",
      inputs: [fields("channels", "Channels")],
      outputs: [field],
      params: {},
    },
    {
      name: "GridSampler",
      label: "Grid Sampler",
      category: "sampler",
      family: "sampler",
      inputs: [latent],
      outputs: [observation],
      params: { shape: int("Grid size", 64, { min: 1 }) },
    },
    {
      name: "PointSampler",
      label: "Point Sampler",
      category: "sampler",
      family: "sampler",
      inputs: [latent],
      outputs: [observation],
      params: { n: int("Points", 1000, { min: 1 }), seed },
    },
    defect("GaussianNoise", "Gaussian Noise", {
      sigma: num("Sigma", 1, { min: 0 }),
      mean: num("Mean", 0),
      seed,
    }),
    defect("PoissonNoise", "Poisson Noise", {
      scale: num("Count scale", 1, { min: 0 }),
      seed,
    }),
    defect("Quantize", "Quantize", {
      levels: int("Levels", 256, { min: 2 }),
      vmin: bound("Min"),
      vmax: bound("Max"),
    }),
    defect("Clip", "Clip", { lo: bound("Low"), hi: bound("High") }),
    defect("Saturate", "Saturate", { ceiling: num("Ceiling", 1, { min: 0 }) }),
    defect("ValueOffset", "Value Offset", { value: num("Offset", 0) }),
    defect("Gain", "Gain", { factor: num("Factor", 1) }),
    defect("Drift", "Drift", { rate: num("Rate", 0) }),
    defect("CoordinateShift", "Coordinate Shift", { shift: num("Shift", 0) }),
    defect("RandomDropout", "Random Dropout", {
      p: num("Probability", 0.1, { min: 0, max: 1, step: 0.01 }),
      seed,
    }),
    defect("PositionJitter", "Position Jitter", { sigma: num("Sigma", 0, { min: 0 }), seed }),
    defect("RandomInsertion", "Random Insertion", { n: int("Points", 10, { min: 0 }), seed }),
    transform("Downsample", "Downsample", { factor: int("Factor", 2, { min: 1 }) }),
    projection("PCA", "PCA", {
      whiten: { type: "boolean", label: "Whiten", default: false },
      svd_solver: {
        type: "enum",
        label: "Solver",
        default: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "full", label: "Full" },
          { value: "covariance_eigh", label: "Covariance" },
          { value: "randomized", label: "Randomized" },
          { value: "arpack", label: "ARPACK" },
        ],
      },
      seed,
    }),
    projection("UMAP", "UMAP", {
      n_neighbors: int("Neighbours", 15, { min: 2 }),
      min_dist: num("Min distance", 0.1, { min: 0, step: 0.05 }),
      metric: {
        type: "enum",
        label: "Metric",
        default: "euclidean",
        options: [
          { value: "euclidean", label: "Euclidean" },
          { value: "manhattan", label: "Manhattan" },
          { value: "chebyshev", label: "Chebyshev" },
          { value: "cosine", label: "Cosine" },
          { value: "correlation", label: "Correlation" },
        ],
      },
      seed,
    }),
    projection("Isomap", "Isomap", { n_neighbors: int("Neighbours", 5, { min: 1 }) }),
    projection("GaussianRandomProjection", "Random Gaussian", { seed }),
  ],
};
