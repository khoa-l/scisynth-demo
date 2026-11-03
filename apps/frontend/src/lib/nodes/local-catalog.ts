import type { IntegerParam, NodeCatalog, NodeKindDef, NumberParam, PortDef } from "./types";

/*
 * A hand-written stand-in for the catalogue the backend will derive from scisynth.
 * Kind names are scisynth class names and parameter names are its dataclass fields.
 * Parameters the UI can't edit yet (domain, callables, arrays, estimators, max_cells,
 * Drift.axis) are left out; every parameter is a fixed value for now, not a distribution.
 */

const field: PortDef = { id: "field", label: "Field", type: "field" };
const observation: PortDef = { id: "observation", label: "Observation", type: "observation" };
const latent: PortDef = { id: "latent", label: "Latent", type: "field" };
/** An input that takes any number of fields. */
const fields = (id: string, label: string): PortDef => ({
  id,
  label,
  type: "field",
  multiple: true,
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

const splineOrder = int("Spline order", 1, { min: 0, max: 5 });

function stage(name: string, label: string, params: NodeKindDef["params"] = {}): NodeKindDef {
  return {
    name,
    label,
    category: "stage",
    inputs: [observation],
    outputs: [observation],
    params,
  };
}

export const localCatalog: NodeCatalog = {
  version: 1,
  categories: [
    { id: "latent", label: "Latent" },
    { id: "sampler", label: "Sampler" },
    { id: "stage", label: "Stages" },
    { id: "projection", label: "Projection" },
  ],
  kinds: [
    {
      name: "GaussianField",
      label: "Gaussian field",
      category: "latent",
      inputs: [],
      outputs: [field],
      params: {
        length_scale: num("Length scale", 0.1, { min: 0, step: 0.01 }),
        amplitude: num("Amplitude", 1),
        mean: num("Mean", 0),
        resolution: int("Resolution", 128, { min: 1 }),
        order: splineOrder,
      },
    },
    {
      name: "AnalyticField",
      label: "Analytic field",
      category: "latent",
      inputs: [],
      outputs: [field],
      params: {},
    },
    {
      name: "InterpolatedField",
      label: "Interpolated field",
      category: "latent",
      inputs: [],
      outputs: [field],
      params: {
        order: splineOrder,
        mode: {
          type: "enum",
          label: "Boundary",
          default: "nearest",
          options: [
            { value: "nearest", label: "Nearest" },
            { value: "grid-wrap", label: "Periodic" },
            { value: "reflect", label: "Reflect" },
            { value: "mirror", label: "Mirror" },
            { value: "constant", label: "Constant" },
          ],
        },
      },
    },
    {
      name: "Sum",
      label: "Sum",
      category: "latent",
      inputs: [fields("terms", "Terms")],
      outputs: [field],
      params: {},
    },
    {
      name: "Product",
      label: "Product",
      category: "latent",
      inputs: [fields("terms", "Terms")],
      outputs: [field],
      params: {},
    },
    {
      name: "Multichannel",
      label: "Multichannel",
      category: "latent",
      inputs: [fields("channels", "Channels")],
      outputs: [field],
      params: {},
    },
    {
      name: "GridSampler",
      label: "Grid sampler",
      category: "sampler",
      inputs: [latent],
      outputs: [observation],
      params: { shape: int("Grid size", 64, { min: 1 }) },
    },
    {
      name: "PointSampler",
      label: "Point sampler",
      category: "sampler",
      inputs: [latent],
      outputs: [observation],
      params: { n: int("Points", 1000, { min: 1 }) },
    },
    stage("GaussianNoise", "Gaussian noise", {
      sigma: num("Sigma", 1, { min: 0 }),
      mean: num("Mean", 0),
    }),
    stage("PoissonNoise", "Poisson noise", { scale: num("Count scale", 1, { min: 0 }) }),
    stage("Quantize", "Quantize", {
      levels: int("Levels", 256, { min: 2 }),
      vmin: bound("Min"),
      vmax: bound("Max"),
    }),
    stage("Clip", "Clip", { lo: bound("Low"), hi: bound("High") }),
    stage("Saturate", "Saturate", { ceiling: num("Ceiling", 1, { min: 0 }) }),
    stage("ValueOffset", "Value offset", { value: num("Offset", 0) }),
    stage("Gain", "Gain", { factor: num("Factor", 1) }),
    stage("Drift", "Drift", { rate: num("Rate", 0) }),
    stage("CoordinateShift", "Coordinate shift", { shift: num("Shift", 0) }),
    stage("RandomDropout", "Random dropout", {
      p: num("Probability", 0.1, { min: 0, max: 1, step: 0.01 }),
    }),
    stage("PositionJitter", "Position jitter", { sigma: num("Sigma", 0, { min: 0 }) }),
    stage("RandomInsertion", "Random insertion", { n: int("Points", 10, { min: 0 }) }),
    stage("Downsample", "Downsample", { factor: int("Factor", 2, { min: 1 }) }),
    {
      name: "Projection",
      label: "Projection",
      category: "projection",
      inputs: [observation],
      outputs: [],
      params: {},
    },
  ],
};
