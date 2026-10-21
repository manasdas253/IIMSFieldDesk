import { describe, expect, it } from "vitest";
import { resolveOpenFreeMapResource } from "./mapTileProxy";

describe("resolveOpenFreeMapResource", () => {
  it("allows the style, TileJSON and vector tile paths on the fixed provider", () => {
    expect(resolveOpenFreeMapResource("styles/liberty")?.href).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(resolveOpenFreeMapResource("planet")?.href).toBe("https://tiles.openfreemap.org/planet");
    expect(resolveOpenFreeMapResource("planet/latest/6/46/27.pbf")?.href).toBe("https://tiles.openfreemap.org/planet/latest/6/46/27.pbf");
  });

  it("allows nested OpenFreeMap sprite JSON and image files", () => {
    expect(resolveOpenFreeMapResource("sprites/ofm_f384/ofm.json")?.href).toBe("https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json");
    expect(resolveOpenFreeMapResource("sprites/ofm_f384/ofm@2x.png")?.href).toBe("https://tiles.openfreemap.org/sprites/ofm_f384/ofm%402x.png");
  });

  it("allows encoded font names but rejects traversal and unrelated hosts", () => {
    expect(resolveOpenFreeMapResource("fonts/Noto%20Sans%20Regular%2CNoto%20Sans%20Regular/0-255.pbf")?.pathname).toBe("/fonts/Noto%20Sans%20Regular%2CNoto%20Sans%20Regular/0-255.pbf");
    expect(resolveOpenFreeMapResource("styles/%2e%2e/secret")).toBeNull();
    expect(resolveOpenFreeMapResource("https://evil.example/tile")).toBeNull();
    expect(resolveOpenFreeMapResource("private/data")).toBeNull();
  });
});
