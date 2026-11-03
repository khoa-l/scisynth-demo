import { describe, it, expect } from "vite-plus/test";

import { QueryClient } from "@tanstack/vue-query";

import {
  canConnect,
  defaultParams,
  findKind,
  nodeCatalogQuery,
} from "../lib/dataset-nodes/catalog";
import { localCatalog } from "../lib/dataset-nodes/local-catalog";
import { isValidParam } from "../lib/dataset-nodes/params";

describe("Node catalog", () => {
  it("is what the catalog query loads", async () => {
    expect(await new QueryClient().fetchQuery(nodeCatalogQuery)).toBe(localCatalog);
  });

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

  it("gives a new node its kind's default parameters", () => {
    expect(defaultParams(findKind(localCatalog, "Quantize")!)).toEqual({
      levels: 256,
      vmin: null,
      vmax: null,
    });
    expect(defaultParams(findKind(localCatalog, "Sum")!)).toEqual({});
  });

  it("only connects an output to an input of the same type", () => {
    const link = (sourceKind: string, sourcePort: string, targetKind: string, targetPort: string) =>
      canConnect(localCatalog, { sourceKind, sourcePort, targetKind, targetPort });

    expect(link("GaussianField", "field", "Sum", "terms")).toBe(true);
    expect(link("GaussianField", "field", "GridSampler", "latent")).toBe(true);
    expect(link("GridSampler", "observation", "GaussianNoise", "observation")).toBe(true);
    expect(link("GaussianNoise", "observation", "Projection", "observation")).toBe(true);

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
});
