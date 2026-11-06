import { describe, it, expect } from "vite-plus/test";

import { canConnect, findKind, requiredConnections } from "../lib/dataset-nodes/catalog";
import { localCatalog } from "../lib/dataset-nodes/local-catalog";
import { isValidParam } from "../lib/dataset-nodes/params";

describe("Node catalog", () => {
  it("has unique kind names, each in a known category", () => {
    const names = localCatalog.kinds.map((kind) => kind.name);
    expect(new Set(names).size).toBe(names.length);
    const categories = new Set(localCatalog.categories.map((category) => category.id));
    expect(localCatalog.kinds.every((kind) => categories.has(kind.category))).toBe(true);
  });

  it("has defaults that satisfy each parameter's own rules", () => {
    for (const kind of localCatalog.kinds) {
      for (const [name, def] of Object.entries(kind.params)) {
        expect(isValidParam(def, def.default), `${kind.name}.${name}`).toBe(true);
      }
    }
  });

  it("gives a seed to every kind that draws random numbers", () => {
    const seeded = localCatalog.kinds.filter((kind) => "seed" in kind.params).map((k) => k.name);

    expect(seeded).toEqual([
      "GaussianField",
      "GaussianBumps",
      "PointSampler",
      "GaussianNoise",
      "PoissonNoise",
      "RandomDropout",
      "PositionJitter",
      "RandomInsertion",
      "UMAP",
    ]);
  });

  it("only connects an output to an input of the same type", () => {
    const link = (sourceKind: string, sourcePort: string, targetKind: string, targetPort: string) =>
      canConnect(localCatalog, { sourceKind, sourcePort, targetKind, targetPort });

    expect(link("GaussianField", "field", "Sum", "terms")).toBe(true);
    expect(link("GaussianField", "field", "GridSampler", "latent")).toBe(true);
    expect(link("GridSampler", "observation", "GaussianNoise", "observation")).toBe(true);
    expect(link("GaussianNoise", "observation", "PCA", "observation")).toBe(true);
    expect(link("Downsample", "observation", "UMAP", "observation")).toBe(true);

    expect(link("GaussianField", "field", "GaussianNoise", "observation")).toBe(false);
    expect(link("GridSampler", "observation", "Sum", "terms")).toBe(false);
    expect(link("GaussianField", "nope", "Sum", "terms")).toBe(false);
  });

  it("allows links to kinds it doesn't know, since it can't check them", () => {
    expect(
      canConnect(localCatalog, {
        sourceKind: "RemovedStage",
        sourcePort: "out",
        targetKind: "Sum",
        targetPort: "terms",
      }),
    ).toBe(true);
  });

  it("needs one connection on each input, and two terms for Sum and Product", () => {
    const required = (name: string) =>
      findKind(localCatalog, name)!.inputs.map((port) => requiredConnections(port));

    expect(required("GridSampler")).toEqual([1]);
    expect(required("GaussianNoise")).toEqual([1]);
    expect(required("PCA")).toEqual([1]);
    expect(required("UMAP")).toEqual([1]);
    expect(required("Multichannel")).toEqual([1]);
    expect(required("Sum")).toEqual([2]);
    expect(required("Product")).toEqual([2]);
  });
});
