import type { AssetGraphEdge, AssetSystem } from "@/types/asset";
import type { AssetMetadataOverride } from "@/types/asset";

const STORAGE_KEY = "stardesk_asset_catalog_v1";

export type PersistedAssetCatalog = {
  systems: AssetSystem[];
  extraEdges: AssetGraphEdge[];
  removedEdgeIds: string[];
  deletedAssetIds: string[];
  metadata: Record<string, AssetMetadataOverride>;
};

export function loadPersistedCatalog(): PersistedAssetCatalog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedAssetCatalog;
    if (!Array.isArray(parsed.systems)) return null;
    return {
      systems: parsed.systems,
      extraEdges: Array.isArray(parsed.extraEdges) ? parsed.extraEdges : [],
      removedEdgeIds: Array.isArray(parsed.removedEdgeIds) ? parsed.removedEdgeIds : [],
      deletedAssetIds: Array.isArray(parsed.deletedAssetIds) ? parsed.deletedAssetIds : [],
      metadata: parsed.metadata && typeof parsed.metadata === "object" ? parsed.metadata : {},
    };
  } catch {
    return null;
  }
}

export function savePersistedCatalog(catalog: PersistedAssetCatalog): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // ignore quota
  }
}
