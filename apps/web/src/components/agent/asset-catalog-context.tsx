"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { MOCK_ASSET_EDGES, SYSTEM_ANCHORS } from "@/lib/asset-graph";
import {
  loadPersistedCatalog,
  savePersistedCatalog,
  type PersistedAssetCatalog,
} from "@/lib/asset-catalog-storage";
import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import type {
  AssetGraphEdge,
  AssetMetadataOverride,
  AssetStatus,
  AssetEnvironment,
} from "@/types/asset";
import type { AssetSubsystem, AssetSystem } from "@/types/asset";

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
  deleteAsset: (assetId: string) => boolean;
  addConnection: (sourceId: string, targetId: string) => string | null;
  removeConnection: (edgeId: string) => void;
  isCustomAsset: (assetId: string) => boolean;
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

export function AssetCatalogProvider({ children }: { children: ReactNode }) {
  const [systems, setSystems] = useState<AssetSystem[]>(() => cloneSystems(MOCK_ASSET_SYSTEMS));
  const [extraEdges, setExtraEdges] = useState<AssetGraphEdge[]>([]);
  const [removedEdgeIds, setRemovedEdgeIds] = useState<Set<string>>(() => new Set());
  const [metadata, setMetadata] = useState<Record<string, AssetMetadataOverride>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadPersistedCatalog();
    if (saved) {
      setSystems(cloneSystems(saved.systems));
      setExtraEdges(saved.extraEdges);
      setRemovedEdgeIds(new Set(saved.removedEdgeIds));
      setMetadata(saved.metadata);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState({
      systems,
      extraEdges,
      removedEdgeIds: [...removedEdgeIds],
      metadata,
    });
  }, [systems, extraEdges, removedEdgeIds, metadata, hydrated]);

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
        !removedEdgeIds.has(e.id),
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
  }, [systems, extraEdges, removedEdgeIds]);

  const isCustomAsset = useCallback((assetId: string) => !INITIAL_MOCK_IDS.has(assetId), []);

  const addAsset = useCallback(
    (input: AddAssetInput): string | null => {
      const name = input.name.trim();
      const code = input.code.trim().toUpperCase();
      if (!name || !code) return null;

      const existingIds = new Set<string>();
      for (const system of systems) {
        existingIds.add(system.id);
        for (const sub of system.subsystems) existingIds.add(sub.id);
      }

      if (input.kind === "subsystem") {
        const parentId = input.parentSystemId;
        if (!parentId) return null;
        const parentIndex = systems.findIndex((s) => s.id === parentId);
        if (parentIndex < 0) return null;

        const subId = uniqueId("sub", code, existingIds);
        const subsystem: AssetSubsystem = {
          id: subId,
          system_id: parentId,
          name,
          code,
        };

        setSystems((prev) =>
          prev.map((s) =>
            s.id === parentId ? { ...s, subsystems: [...s.subsystems, subsystem] } : s,
          ),
        );
        setExtraEdges((prev) => [
          ...prev,
          { id: `e-custom-${subId}`, source: parentId, target: subId },
        ]);
        return subId;
      }

      const sysId = uniqueId("sys", code, existingIds);
      SYSTEM_ANCHORS[sysId] = defaultAnchorForNewSystem(systems);

      const system: AssetSystem = {
        id: sysId,
        name,
        code,
        subsystems: [],
      };

      setSystems((prev) => [...prev, system]);
      return sysId;
    },
    [systems],
  );

  const updateAsset = useCallback((assetId: string, input: UpdateAssetInput): boolean => {
    let found = false;
    setSystems((prev) =>
      prev.map((system) => {
        if (system.id === assetId) {
          found = true;
          return {
            ...system,
            name: input.name?.trim() || system.name,
            code: input.code?.trim().toUpperCase() || system.code,
          };
        }
        return {
          ...system,
          subsystems: system.subsystems.map((sub) => {
            if (sub.id !== assetId) return sub;
            found = true;
            return {
              ...sub,
              name: input.name?.trim() || sub.name,
              code: input.code?.trim().toUpperCase() || sub.code,
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

    return found;
  }, []);

  const deleteAsset = useCallback(
    (assetId: string): boolean => {
      if (!isCustomAsset(assetId)) return false;

      setSystems((prev) => {
        const withoutSystem = prev.filter((s) => s.id !== assetId);
        if (withoutSystem.length !== prev.length) return withoutSystem;
        return prev.map((s) => ({
          ...s,
          subsystems: s.subsystems.filter((sub) => sub.id !== assetId),
        }));
      });

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
      return true;
    },
    [isCustomAsset],
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
      return edgeId;
    },
    [allEdges],
  );

  const removeConnection = useCallback((edgeId: string) => {
    if (MOCK_ASSET_EDGES.some((e) => e.id === edgeId)) {
      setRemovedEdgeIds((prev) => new Set(prev).add(edgeId));
      return;
    }
    setExtraEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

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
