import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { PersistedAssetCatalog } from "@/lib/asset-catalog-storage";
import type {
  CmdbAuditCreatePayload,
  CmdbAuditEntry,
  CmdbAuditLogPage,
} from "@/types/cmdb-audit";

type CmdbCatalogApiPayload = {
  systems?: PersistedAssetCatalog["systems"];
  extra_edges?: PersistedAssetCatalog["extraEdges"];
  removed_edge_ids?: string[];
  deleted_asset_ids?: string[];
  metadata?: PersistedAssetCatalog["metadata"];
};

export async function fetchCmdbCatalog(): Promise<PersistedAssetCatalog | null> {
  try {
    const res = await apiGet<{ payload: CmdbCatalogApiPayload }>("/api/v1/assets/catalog");
    const p = res.payload;
    return {
      systems: p.systems ?? [],
      extraEdges: p.extra_edges ?? [],
      removedEdgeIds: p.removed_edge_ids ?? [],
      deletedAssetIds: p.deleted_asset_ids ?? [],
      metadata: p.metadata ?? {},
    };
  } catch {
    return null;
  }
}

export async function saveCmdbCatalog(catalog: PersistedAssetCatalog): Promise<void> {
  await apiPut("/api/v1/assets/catalog", {
    payload: {
      systems: catalog.systems,
      extra_edges: catalog.extraEdges,
      removed_edge_ids: catalog.removedEdgeIds,
      deleted_asset_ids: catalog.deletedAssetIds,
      metadata: catalog.metadata,
    },
  });
}

export async function postCmdbAuditEntry(payload: CmdbAuditCreatePayload): Promise<CmdbAuditEntry> {
  return apiPost<CmdbAuditEntry>("/api/v1/assets/audit-log", payload);
}

export async function fetchCmdbAuditLog(params?: {
  beforeId?: string;
  q?: string;
  byteBudget?: number;
}): Promise<CmdbAuditLogPage> {
  const search = new URLSearchParams();
  if (params?.beforeId) search.set("before_id", params.beforeId);
  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.byteBudget) search.set("byte_budget", String(params.byteBudget));
  const qs = search.toString();
  return apiGet<CmdbAuditLogPage>(`/api/v1/assets/audit-log${qs ? `?${qs}` : ""}`);
}
