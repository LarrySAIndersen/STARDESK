import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import type { AssetGraphData, AssetGraphEdge, AssetGraphNode } from "@/types/asset";

/** World-map region anchors (viewBox 0–1000 × 760). */
const SYSTEM_ANCHORS: Record<string, { x: number; y: number }> = {
  "sys-star-platform": { x: 500, y: 360 },
  "sys-infrastruktur": { x: 185, y: 400 },
  "sys-integration": { x: 815, y: 400 },
  "sys-forretning": { x: 500, y: 660 },
  "sys-sikkerhed": { x: 270, y: 155 },
  "sys-drift": { x: 755, y: 615 },
};

const SYSTEM_RADIUS = 44;
const SUBSYSTEM_RADIUS = 26;
const SUBSYSTEM_ORBIT = 105;

/**
 * Mock dependency graph — hub links per system, cross-domain integrations,
 * and plausible CMDB relationships between subsystems.
 */
export const MOCK_ASSET_EDGES: AssetGraphEdge[] = [
  { id: "e-plat-auth", source: "sys-star-platform", target: "sub-auth" },
  { id: "e-plat-portal", source: "sys-star-platform", target: "sub-portal" },
  { id: "e-plat-api", source: "sys-star-platform", target: "sub-api" },
  { id: "e-infra-net", source: "sys-infrastruktur", target: "sub-netvaerk" },
  { id: "e-infra-db", source: "sys-infrastruktur", target: "sub-database" },
  { id: "e-infra-dns", source: "sys-infrastruktur", target: "sub-dns" },
  { id: "e-int-teams", source: "sys-integration", target: "sub-teams" },
  { id: "e-int-slack", source: "sys-integration", target: "sub-slack" },
  { id: "e-int-mail", source: "sys-integration", target: "sub-email" },
  { id: "e-biz-erp", source: "sys-forretning", target: "sub-erp" },
  { id: "e-biz-crm", source: "sys-forretning", target: "sub-crm" },
  { id: "e-biz-bi", source: "sys-forretning", target: "sub-rapportering" },
  { id: "e-biz-doc", source: "sys-forretning", target: "sub-dokument" },
  { id: "e-sec-iam", source: "sys-sikkerhed", target: "sub-iam" },
  { id: "e-sec-mon", source: "sys-sikkerhed", target: "sub-overvaagning" },
  { id: "e-ops-bkp", source: "sys-drift", target: "sub-backup" },
  { id: "e-ops-log", source: "sys-drift", target: "sub-logging" },
  { id: "e-ops-alrt", source: "sys-drift", target: "sub-alerting" },
  { id: "e-cross-infra-int", source: "sys-infrastruktur", target: "sys-integration" },
  { id: "e-cross-plat-sec", source: "sys-star-platform", target: "sys-sikkerhed" },
  { id: "e-db-api", source: "sub-database", target: "sub-api" },
  { id: "e-auth-iam", source: "sub-auth", target: "sub-iam" },
  { id: "e-api-erp", source: "sub-api", target: "sub-erp" },
  { id: "e-net-dns", source: "sub-netvaerk", target: "sub-dns" },
  { id: "e-slack-portal", source: "sub-slack", target: "sub-portal" },
  { id: "e-teams-portal", source: "sub-teams", target: "sub-portal" },
  { id: "e-mail-portal", source: "sub-email", target: "sub-portal" },
  { id: "e-backup-db", source: "sub-backup", target: "sub-database" },
  { id: "e-log-mon", source: "sub-logging", target: "sub-overvaagning" },
  { id: "e-alrt-mon", source: "sub-alerting", target: "sub-overvaagning" },
  { id: "e-crm-portal", source: "sub-crm", target: "sub-portal" },
  { id: "e-bi-erp", source: "sub-rapportering", target: "sub-erp" },
  { id: "e-doc-crm", source: "sub-dokument", target: "sub-crm" },
  { id: "e-plat-drift", source: "sys-star-platform", target: "sys-drift" },
];

function subsystemPosition(
  anchor: { x: number; y: number },
  index: number,
  total: number,
): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: anchor.x + SUBSYSTEM_ORBIT * Math.cos(angle),
    y: anchor.y + SUBSYSTEM_ORBIT * Math.sin(angle),
  };
}

export function buildAssetGraph(): AssetGraphData {
  const nodes: AssetGraphNode[] = [];

  for (const system of MOCK_ASSET_SYSTEMS) {
    const anchor = SYSTEM_ANCHORS[system.id] ?? { x: 500, y: 400 };
    nodes.push({
      id: system.id,
      label: system.name,
      kind: "system",
      categorySystemId: system.id,
      x: anchor.x,
      y: anchor.y,
      radius: SYSTEM_RADIUS,
    });

    system.subsystems.forEach((sub, index) => {
      const pos = subsystemPosition(anchor, index, system.subsystems.length);
      nodes.push({
        id: sub.id,
        label: sub.name,
        kind: "undersystem",
        categorySystemId: system.id,
        x: pos.x,
        y: pos.y,
        radius: SUBSYSTEM_RADIUS,
      });
    });
  }

  return { nodes, edges: MOCK_ASSET_EDGES };
}

export function getGraphNeighborIds(assetId: string, edges = MOCK_ASSET_EDGES): Set<string> {
  const neighbors = new Set<string>();
  for (const edge of edges) {
    if (edge.source === assetId) neighbors.add(edge.target);
    if (edge.target === assetId) neighbors.add(edge.source);
  }
  return neighbors;
}

export const ASSET_GRAPH_LAYOUT_KEY = "stardesk_asset_graph_layout";

export type AssetGraphLayout = Record<string, { x: number; y: number }>;

export function getDefaultNodePositions(graph: AssetGraphData): AssetGraphLayout {
  const positions: AssetGraphLayout = {};
  for (const node of graph.nodes) {
    positions[node.id] = { x: node.x, y: node.y };
  }
  return positions;
}

export function getAllAssetIds(): string[] {
  const ids: string[] = [];
  for (const system of MOCK_ASSET_SYSTEMS) {
    ids.push(system.id);
    for (const sub of system.subsystems) {
      ids.push(sub.id);
    }
  }
  return ids;
}

export function loadGraphLayout(): AssetGraphLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ASSET_GRAPH_LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssetGraphLayout;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveGraphLayout(layout: AssetGraphLayout): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASSET_GRAPH_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* quota / private mode */
  }
}

export function clearGraphLayout(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ASSET_GRAPH_LAYOUT_KEY);
  } catch {
    /* ignore */
  }
}

export function mergeNodePositions(
  graph: AssetGraphData,
  saved: AssetGraphLayout | null,
): AssetGraphLayout {
  const defaults = getDefaultNodePositions(graph);
  if (!saved) return defaults;
  const merged = { ...defaults };
  for (const node of graph.nodes) {
    const pos = saved[node.id];
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      merged[node.id] = { x: pos.x, y: pos.y };
    }
  }
  return merged;
}

export function filterGraphByVisibility(
  graph: AssetGraphData,
  visibleIds: Set<string>,
): AssetGraphData {
  const nodes = graph.nodes.filter((n) => visibleIds.has(n.id));
  const visible = visibleIds;
  const edges = graph.edges.filter(
    (e) => visible.has(e.source) && visible.has(e.target),
  );
  return { nodes, edges };
}

export function getSystemVisibilityState(
  systemId: string,
  visibleIds: Set<string>,
): "all" | "some" | "none" {
  const system = MOCK_ASSET_SYSTEMS.find((s) => s.id === systemId);
  if (!system) return "none";
  const ids = [system.id, ...system.subsystems.map((sub) => sub.id)];
  const visibleCount = ids.filter((id) => visibleIds.has(id)).length;
  if (visibleCount === 0) return "none";
  if (visibleCount === ids.length) return "all";
  return "some";
}
