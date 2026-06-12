import { describe, expect, it } from "vitest";

import { assetEntityType, filterDeletedAssets } from "./asset-catalog-filter";
import type { AssetSystem } from "@/types/asset";

const systems: AssetSystem[] = [
  {
    id: "sys-1",
    name: "Platform",
    code: "PLAT",
    subsystems: [
      { id: "sub-auth", system_id: "sys-1", name: "Auth", code: "AUTH" },
      { id: "sub-api", system_id: "sys-1", name: "API", code: "API" },
    ],
  },
  {
    id: "sys-2",
    name: "Legacy",
    code: "LEG",
    subsystems: [],
  },
];

describe("filterDeletedAssets", () => {
  it("returns systems unchanged when no deletions", () => {
    expect(filterDeletedAssets(systems, new Set())).toEqual(systems);
  });

  it("removes deleted systems and subsystems", () => {
    const filtered = filterDeletedAssets(systems, new Set(["sys-2", "sub-auth"]));
    expect(filtered.map((s) => s.id)).toEqual(["sys-1"]);
    expect(filtered[0]?.subsystems.map((s) => s.id)).toEqual(["sub-api"]);
  });
});

describe("assetEntityType", () => {
  it("detects subsystem ids by prefix", () => {
    expect(assetEntityType("sys-1")).toBe("system");
    expect(assetEntityType("sub-auth")).toBe("subsystem");
  });
});
