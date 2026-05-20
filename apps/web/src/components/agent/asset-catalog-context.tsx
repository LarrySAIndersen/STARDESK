"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SYSTEM_ANCHORS } from "@/lib/asset-graph";
import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import type { AssetGraphEdge } from "@/types/asset";
import type { AssetSubsystem, AssetSystem } from "@/types/asset";

export type AddAssetInput = {
  kind: "system" | "subsystem";
  name: string;
  code: string;
  /** Required when kind is subsystem */
  parentSystemId?: string;
};

interface AssetCatalogContextValue {
  systems: AssetSystem[];
  extraEdges: AssetGraphEdge[];
  addAsset: (input: AddAssetInput) => string | null;
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
    const clash = [...used].some(
      (u) => Math.hypot(u.x - c.x, u.y - c.y) < 120,
    );
    if (!clash) return c;
  }
  return { x: 500 + (systems.length % 5) * 40, y: 400 };
}

export function AssetCatalogProvider({ children }: { children: ReactNode }) {
  const [systems, setSystems] = useState<AssetSystem[]>(() => cloneSystems(MOCK_ASSET_SYSTEMS));
  const [extraEdges, setExtraEdges] = useState<AssetGraphEdge[]>([]);

  const addAsset = useCallback((input: AddAssetInput): string | null => {
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
    const anchor = defaultAnchorForNewSystem(systems);
    SYSTEM_ANCHORS[sysId] = anchor;

    const system: AssetSystem = {
      id: sysId,
      name,
      code,
      subsystems: [],
    };

    setSystems((prev) => [...prev, system]);
    return sysId;
  }, [systems]);

  const value = useMemo(
    () => ({ systems, extraEdges, addAsset }),
    [systems, extraEdges, addAsset],
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
