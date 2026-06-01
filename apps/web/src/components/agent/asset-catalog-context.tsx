"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MOCK_ASSET_EDGES, SYSTEM_ANCHORS } from "@/lib/asset-graph";
import {
  assetEntityType,
  filterDeletedAssets,
} from "@/lib/asset-catalog-filter";
import {
  loadPersistedCatalog,
  savePersistedCatalog,
  type PersistedAssetCatalog,
} from "@/lib/asset-catalog-storage";
import { fetchCmdbCatalog, postCmdbAuditEntry, saveCmdbCatalog } from "@/lib/cmdb-api";
import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import type {
  AssetGraphEdge,
  AssetMetadataOverride,
  AssetStatus,
  AssetEnvironment,
} from "@/types/asset";
import type { AssetSubsystem, AssetSystem } from "@/types/asset";
import type { CmdbAuditAction, CmdbEntityType } from "@/types/cmdb-audit";

export type AddAssetInput = {
  kind: "system" | "subsystem";
  name: string;
  code: string;
  parentSystemId?: string;
};

export type UpdateAssetInput = {
  name?: string;
  code?: string;
  status?: AssetStatus;
  ownerTeam?: string;
  environment?: AssetEnvironment;
  description?: string;
};

const INITIAL_MOCK_IDS = new Set<string>();
for (const system of MOCK_ASSET_SYSTEMS) {
  INITIAL_MOCK_IDS.add(system.id);
  for (const sub of system.subsystems) INITIAL_MOCK_IDS.add(sub.id);
}

interface AssetCatalogContextValue {
  systems: AssetSystem[];
  extraEdges: AssetGraphEdge[];
  removedEdgeIds: Set<string>;
  metadata: Record<string, AssetMetadataOverride>;
  allEdges: AssetGraphEdge[];
  addAsset: (input: AddAssetInput) => string | null;
  updateAsset: (assetId: string, input: UpdateAssetInput) => boolean;
  deleteAsset: (assetId: string, label?: string) => boolean;
  addConnection: (sourceId: string, targetId: string) => string | null;
  removeConnection: (edgeId: string) => void;
  isCustomAsset: (assetId: string) => boolean;
  refreshAuditLog: () => void;
  auditLogVersion: number;
}

const AssetCatalogContext = createContext<AssetCatalogContextValue | null>(null);

function cloneSystems(systems: AssetSystem[]): AssetSystem[] {
  return systems.map((s) => ({
    ...s,
    subsystems: s.subsystems.map((sub) => ({ ...sub })),
  }));
}

function slugId(prefix: "sys" | "sub", code: string): string {
  const slug = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `${prefix}-${slug || "ny"}`;
}

function uniqueId(prefix: "sys" | "sub", code: string, existing: Set<string>): string {
  const base = slugId(prefix, code);
  let candidate = base;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

function defaultAnchorForNewSystem(systems: AssetSystem[]): { x: number; y: number } {
  const used = new Set(
    systems.map((s) => SYSTEM_ANCHORS[s.id]).filter(Boolean) as { x: number; y: number }[],
  );
  const candidates = [
    { x: 500, y: 120 },
    { x: 120, y: 280 },
    { x: 880, y: 280 },
    { x: 500, y: 700 },
    { x: 120, y: 620 },
    { x: 880, y: 120 },
  ];
  for (const c of candidates) {
    const clash = [...used].some((u) => Math.hypot(u.x - c.x, u.y - c.y) < 120);
    if (!clash) return c;
  }
  return { x: 500 + (systems.length % 5) * 40, y: 400 };
}

function persistState(state: PersistedAssetCatalog) {
  savePersistedCatalog(state);
}

function toPersisted(
  systems: AssetSystem[],
  extraEdges: AssetGraphEdge[],
  removedEdgeIds: Set<string>,
  deletedAssetIds: Set<string>,
  metadata: Record<string, AssetMetadataOverride>,
): PersistedAssetCatalog {
  return {
    systems,
    extraEdges,
    removedEdgeIds: [...removedEdgeIds],
    deletedAssetIds: [...deletedAssetIds],
    metadata,
  };
}

export function AssetCatalogProvider({
  children,
  syncToDb = false,
}: {
  children: ReactNode;
  syncToDb?: boolean;
}) {
  const [rawSystems, setRawSystems] = useState<AssetSystem[]>(() =>
    cloneSystems(MOCK_ASSET_SYSTEMS),
  );
  const [extraEdges, setExtraEdges] = useState<AssetGraphEdge[]>([]);
  const [removedEdgeIds, setRemovedEdgeIds] = useState<Set<string>>(() => new Set());
  const [deletedAssetIds, setDeletedAssetIds] = useState<Set<string>>(() => new Set());
  const [metadata, setMetadata] = useState<Record<string, AssetMetadataOverride>>({});
  const [hydrated, setHydrated] = useState(false);
  const [auditLogVersion, setAuditLogVersion] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const systems = useMemo(
    () => filterDeletedAssets(rawSystems, deletedAssetIds),
    [rawSystems, deletedAssetIds],
  );

  const refreshAuditLog = useCallback(() => {
    setAuditLogVersion((v) => v + 1);
  }, []);

  const recordAudit = useCallback(
    async (
      action: CmdbAuditAction,
      entityType: CmdbEntityType,
      entityId: string,
      entityLabel: string,
      changes: Record<string, unknown> = {},
      summaryDa?: string,
    ) => {
      if (!syncToDb) return;
      try {
        await postCmdbAuditEntry({
          action,
          entity_type: entityType,
          entity_id: entityId,
          entity_label: entityLabel,
          changes,
          summary_da: summaryDa,
        });
        refreshAuditLog();
      } catch {
        // API unavailable — local state still updated
      }
    },
    [syncToDb, refreshAuditLog],
  );

  const scheduleDbSave = useCallback(() => {
    if (!syncToDb || !hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fireAndForget(saveCmdbCatalog(
        toPersisted(rawSystems, extraEdges, removedEdgeIds, deletedAssetIds, metadata),
      ).catch(() => undefined));
    }, 600);
  }, [syncToDb, hydrated, rawSystems, extraEdges, removedEdgeIds, deletedAssetIds, metadata]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (syncToDb) {
        const remote = await fetchCmdbCatalog();
        if (!cancelled && remote) {
          setRawSystems(cloneSystems(remote.systems.length ? remote.systems : MOCK_ASSET_SYSTEMS));
          setExtraEdges(remote.extraEdges);
          setRemovedEdgeIds(new Set(remote.removedEdgeIds));
          setDeletedAssetIds(new Set(remote.deletedAssetIds));
          setMetadata(remote.metadata);
          setHydrated(true);
          return;
        }
      }
      const saved = loadPersistedCatalog();
      if (!cancelled && saved) {
        setRawSystems(cloneSystems(saved.systems));
        setExtraEdges(saved.extraEdges);
        setRemovedEdgeIds(new Set(saved.removedEdgeIds));
        setDeletedAssetIds(new Set(saved.deletedAssetIds ?? []));
        setMetadata(saved.metadata);
      }
      if (!cancelled) setHydrated(true);
    }
    fireAndForget(hydrate());
    return () => {
      cancelled = true;
    };
  }, [syncToDb]);

  useEffect(() => {
    if (!hydrated) return;
    persistState(toPersisted(rawSystems, extraEdges, removedEdgeIds, deletedAssetIds, metadata));
    scheduleDbSave();
  }, [
    rawSystems,
    extraEdges,
    removedEdgeIds,
    deletedAssetIds,
    metadata,
    hydrated,
    scheduleDbSave,
  ]);

  const allEdges = useMemo(() => {
    const nodeIds = new Set<string>();
    for (const system of systems) {
      nodeIds.add(system.id);
      for (const sub of system.subsystems) nodeIds.add(sub.id);
    }
    const base = MOCK_ASSET_EDGES.filter(
      (e) =>
        nodeIds.has(e.source) &&
        nodeIds.has(e.target) &&
        !removedEdgeIds.has(e.id) &&
        !deletedAssetIds.has(e.source) &&
        !deletedAssetIds.has(e.target),
    );
    const custom = extraEdges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    );
    const seen = new Set<string>();
    return [...base, ...custom].filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [systems, extraEdges, removedEdgeIds, deletedAssetIds]);

  const isCustomAsset = useCallback((assetId: string) => !INITIAL_MOCK_IDS.has(assetId), []);

  const addAsset = useCallback(
    (input: AddAssetInput): string | null => {
      const name = input.name.trim();
      const code = input.code.trim().toUpperCase();
      if (!name || !code) return null;

      const existingIds = new Set<string>();
      for (const system of rawSystems) {
        existingIds.add(system.id);
        for (const sub of system.subsystems) existingIds.add(sub.id);
      }

      if (input.kind === "subsystem") {
        const parentId = input.parentSystemId;
        if (!parentId) return null;
        const parentIndex = rawSystems.findIndex((s) => s.id === parentId);
        if (parentIndex < 0) return null;

        const subId = uniqueId("sub", code, existingIds);
        const subsystem: AssetSubsystem = {
          id: subId,
          system_id: parentId,
          name,
          code,
        };

        setRawSystems((prev) =>
          prev.map((s) =>
            s.id === parentId ? { ...s, subsystems: [...s.subsystems, subsystem] } : s,
          ),
        );
        setExtraEdges((prev) => [
          ...prev,
          { id: `e-custom-${subId}`, source: parentId, target: subId },
        ]);
        fireAndForget(recordAudit("create", "subsystem", subId, name, {
          code,
          parent_system_id: parentId,
        }));
        return subId;
      }

      const sysId = uniqueId("sys", code, existingIds);
      SYSTEM_ANCHORS[sysId] = defaultAnchorForNewSystem(rawSystems);

      const system: AssetSystem = {
        id: sysId,
        name,
        code,
        subsystems: [],
      };

      setRawSystems((prev) => [...prev, system]);
      fireAndForget(recordAudit("create", "system", sysId, name, { code }));
      return sysId;
    },
    [rawSystems, recordAudit],
  );

  const updateAsset = useCallback(
    (assetId: string, input: UpdateAssetInput): boolean => {
      let found = false;
      let label = assetId;
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      setRawSystems((prev) =>
        prev.map((system) => {
          if (system.id === assetId) {
            found = true;
            label = system.name;
            before.name = system.name;
            before.code = system.code;
            after.name = input.name?.trim() || system.name;
            after.code = input.code?.trim().toUpperCase() || system.code;
            return {
              ...system,
              name: after.name as string,
              code: after.code as string,
            };
          }
          return {
            ...system,
            subsystems: system.subsystems.map((sub) => {
              if (sub.id !== assetId) return sub;
              found = true;
              label = sub.name;
              before.name = sub.name;
              before.code = sub.code;
              after.name = input.name?.trim() || sub.name;
              after.code = input.code?.trim().toUpperCase() || sub.code;
              return {
                ...sub,
                name: after.name as string,
                code: after.code as string,
              };
            }),
          };
        }),
      );

      if (
        input.status ||
        input.ownerTeam ||
        input.environment ||
        input.description !== undefined
      ) {
        const prevMeta = metadata[assetId];
        if (input.status) {
          before.status = prevMeta?.status;
          after.status = input.status;
        }
        if (input.ownerTeam) {
          before.ownerTeam = prevMeta?.ownerTeam;
          after.ownerTeam = input.ownerTeam;
        }
        if (input.environment) {
          before.environment = prevMeta?.environment;
          after.environment = input.environment;
        }
        if (input.description !== undefined) {
          before.description = prevMeta?.description;
          after.description = input.description;
        }
        setMetadata((prev) => ({
          ...prev,
          [assetId]: {
            ...prev[assetId],
            ...(input.status ? { status: input.status } : {}),
            ...(input.ownerTeam ? { ownerTeam: input.ownerTeam } : {}),
            ...(input.environment ? { environment: input.environment } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            lastUpdated: new Date().toISOString().slice(0, 10),
          },
        }));
      }

      if (found) {
        fireAndForget(recordAudit("update", assetEntityType(assetId), assetId, label, {
          before,
          after,
        }));
      }
      return found;
    },
    [metadata, recordAudit],
  );

  const deleteAsset = useCallback(
    (assetId: string, label?: string): boolean => {
      const entityLabel = label ?? assetId;
      const isStandard = INITIAL_MOCK_IDS.has(assetId);

      if (isStandard) {
        setDeletedAssetIds((prev) => new Set(prev).add(assetId));
      } else {
        setRawSystems((prev) => {
          const withoutSystem = prev.filter((s) => s.id !== assetId);
          if (withoutSystem.length !== prev.length) return withoutSystem;
          return prev.map((s) => ({
            ...s,
            subsystems: s.subsystems.filter((sub) => sub.id !== assetId),
          }));
        });
      }

      setExtraEdges((prev) =>
        prev.filter((e) => e.source !== assetId && e.target !== assetId),
      );
      setRemovedEdgeIds((prev) => {
        const next = new Set(prev);
        for (const edge of MOCK_ASSET_EDGES) {
          if (edge.source === assetId || edge.target === assetId) {
            next.add(edge.id);
          }
        }
        return next;
      });
      setMetadata((prev) => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });

      fireAndForget(recordAudit("delete", assetEntityType(assetId), assetId, entityLabel, {
        standard: isStandard,
      }));
      return true;
    },
    [recordAudit],
  );

  const addConnection = useCallback(
    (sourceId: string, targetId: string): string | null => {
      if (sourceId === targetId) return null;
      const exists = allEdges.some(
        (e) =>
          (e.source === sourceId && e.target === targetId) ||
          (e.source === targetId && e.target === sourceId),
      );
      if (exists) return null;
      const edgeId = `e-custom-${sourceId}-${targetId}`;
      setExtraEdges((prev) => [...prev, { id: edgeId, source: sourceId, target: targetId }]);
      setRemovedEdgeIds((prev) => {
        const next = new Set(prev);
        next.delete(edgeId);
        return next;
      });
      fireAndForget(recordAudit("connection_add", "edge", edgeId, `${sourceId} → ${targetId}`, {
        source: sourceId,
        target: targetId,
      }));
      return edgeId;
    },
    [allEdges, recordAudit],
  );

  const removeConnection = useCallback(
    (edgeId: string) => {
      if (MOCK_ASSET_EDGES.some((e) => e.id === edgeId)) {
        setRemovedEdgeIds((prev) => new Set(prev).add(edgeId));
      } else {
        setExtraEdges((prev) => prev.filter((e) => e.id !== edgeId));
      }
      fireAndForget(recordAudit("connection_remove", "edge", edgeId, edgeId));
    },
    [recordAudit],
  );

  const value = useMemo(
    () => ({
      systems,
      extraEdges,
      removedEdgeIds,
      metadata,
      allEdges,
      addAsset,
      updateAsset,
      deleteAsset,
      addConnection,
      removeConnection,
      isCustomAsset,
      refreshAuditLog,
      auditLogVersion,
    }),
    [
      systems,
      extraEdges,
      removedEdgeIds,
      metadata,
      allEdges,
      addAsset,
      updateAsset,
      deleteAsset,
      addConnection,
      removeConnection,
      isCustomAsset,
      refreshAuditLog,
      auditLogVersion,
    ],
  );

  return (
    <AssetCatalogContext.Provider value={value}>{children}</AssetCatalogContext.Provider>
  );
}

export function useAssetCatalog(): AssetCatalogContextValue {
  const ctx = useContext(AssetCatalogContext);
  if (!ctx) {
    throw new Error("useAssetCatalog must be used within AssetCatalogProvider");
  }
  return ctx;
}
