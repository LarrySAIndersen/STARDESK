import type { AssetSystem } from "@/types/asset";

export function filterDeletedAssets(
  systems: AssetSystem[],
  deletedIds: Set<string>,
): AssetSystem[] {
  if (deletedIds.size === 0) {
    return systems;
  }
  return systems
    .filter((system) => !deletedIds.has(system.id))
    .map((system) => ({
      ...system,
      subsystems: system.subsystems.filter((sub) => !deletedIds.has(sub.id)),
    }));
}

export function assetEntityType(assetId: string): "system" | "subsystem" {
  return assetId.startsWith("sub-") ? "subsystem" : "system";
}
