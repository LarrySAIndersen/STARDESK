import type { AssetSystem } from "@/types/asset";

/** Top-level CMDB category — drives graph + tree accent colors. */
export type AssetCategorySystemId =
  | "sys-star-platform"
  | "sys-infrastruktur"
  | "sys-integration"
  | "sys-forretning"
  | "sys-sikkerhed"
  | "sys-drift";

export interface AssetCategoryColor {
  /** CSS color for system nodes and active accents */
  base: string;
  /** Lighter fill for subsystem nodes */
  light: string;
  /** Sidebar chip / marker background */
  muted: string;
  /** Human-readable category label */
  label: string;
}

/** STAR palette — one distinct hue per top-level category. */
export const ASSET_CATEGORY_COLORS: Record<AssetCategorySystemId, AssetCategoryColor> = {
  "sys-star-platform": {
    label: "STAR Platform",
    base: "var(--asset-cat-platform)",
    light: "var(--asset-cat-platform-light)",
    muted: "var(--asset-cat-platform-muted)",
  },
  "sys-infrastruktur": {
    label: "Infrastruktur",
    base: "var(--asset-cat-infra)",
    light: "var(--asset-cat-infra-light)",
    muted: "var(--asset-cat-infra-muted)",
  },
  "sys-integration": {
    label: "Integration",
    base: "var(--asset-cat-integration)",
    light: "var(--asset-cat-integration-light)",
    muted: "var(--asset-cat-integration-muted)",
  },
  "sys-forretning": {
    label: "Forretningsapplikationer",
    base: "var(--asset-cat-business)",
    light: "var(--asset-cat-business-light)",
    muted: "var(--asset-cat-business-muted)",
  },
  "sys-sikkerhed": {
    label: "Sikkerhed",
    base: "var(--asset-cat-security)",
    light: "var(--asset-cat-security-light)",
    muted: "var(--asset-cat-security-muted)",
  },
  "sys-drift": {
    label: "Drift & overvågning",
    base: "var(--asset-cat-ops)",
    light: "var(--asset-cat-ops-light)",
    muted: "var(--asset-cat-ops-muted)",
  },
};

/** Static CMDB hierarchy until assets are persisted in the database. */
export const MOCK_ASSET_SYSTEMS: AssetSystem[] = [
  {
    id: "sys-star-platform",
    name: "STAR Platform",
    code: "STAR",
    subsystems: [
      { id: "sub-auth", system_id: "sys-star-platform", name: "Auth", code: "AUTH" },
      { id: "sub-portal", system_id: "sys-star-platform", name: "Portal", code: "PORTAL" },
      { id: "sub-api", system_id: "sys-star-platform", name: "API", code: "API" },
    ],
  },
  {
    id: "sys-infrastruktur",
    name: "Infrastruktur",
    code: "INFRA",
    subsystems: [
      { id: "sub-netvaerk", system_id: "sys-infrastruktur", name: "Netværk", code: "NET" },
      { id: "sub-database", system_id: "sys-infrastruktur", name: "Database", code: "DB" },
      { id: "sub-dns", system_id: "sys-infrastruktur", name: "DNS", code: "DNS" },
    ],
  },
  {
    id: "sys-integration",
    name: "Integration",
    code: "INT",
    subsystems: [
      { id: "sub-teams", system_id: "sys-integration", name: "Microsoft Teams", code: "TEAMS" },
      { id: "sub-slack", system_id: "sys-integration", name: "Slack", code: "SLACK" },
      { id: "sub-email", system_id: "sys-integration", name: "E-mail gateway", code: "MAIL" },
    ],
  },
  {
    id: "sys-forretning",
    name: "Forretningsapplikationer",
    code: "BIZ",
    subsystems: [
      { id: "sub-erp", system_id: "sys-forretning", name: "ERP", code: "ERP" },
      { id: "sub-crm", system_id: "sys-forretning", name: "CRM", code: "CRM" },
      { id: "sub-rapportering", system_id: "sys-forretning", name: "Rapportering", code: "BI" },
      { id: "sub-dokument", system_id: "sys-forretning", name: "Dokumenthåndtering", code: "DOC" },
    ],
  },
  {
    id: "sys-sikkerhed",
    name: "Sikkerhed",
    code: "SEC",
    subsystems: [
      { id: "sub-iam", system_id: "sys-sikkerhed", name: "IAM", code: "IAM" },
      { id: "sub-overvaagning", system_id: "sys-sikkerhed", name: "Overvågning", code: "MON" },
    ],
  },
  {
    id: "sys-drift",
    name: "Drift & overvågning",
    code: "OPS",
    subsystems: [
      { id: "sub-backup", system_id: "sys-drift", name: "Backup", code: "BKP" },
      { id: "sub-logging", system_id: "sys-drift", name: "Logning", code: "LOG" },
      { id: "sub-alerting", system_id: "sys-drift", name: "Alerting", code: "ALRT" },
    ],
  },
];

export function getAssetCategorySystemId(assetId: string): AssetCategorySystemId | null {
  if (assetId in ASSET_CATEGORY_COLORS) {
    return assetId as AssetCategorySystemId;
  }
  for (const system of MOCK_ASSET_SYSTEMS) {
    if (system.subsystems.some((s) => s.id === assetId)) {
      return system.id as AssetCategorySystemId;
    }
  }
  return null;
}

export function getAssetCategoryColor(assetId: string): AssetCategoryColor | null {
  const categoryId = getAssetCategorySystemId(assetId);
  return categoryId ? ASSET_CATEGORY_COLORS[categoryId] : null;
}

/** Theme for graph/tree — falls back for user-added systems. */
export function getCategoryTheme(categorySystemId: string): AssetCategoryColor {
  if (categorySystemId in ASSET_CATEGORY_COLORS) {
    return ASSET_CATEGORY_COLORS[categorySystemId as AssetCategorySystemId];
  }
  return {
    label: "Tilføjet aktiv",
    base: "var(--star-navy)",
    light: "var(--star-blue-light)",
    muted: "var(--star-blue-light)",
  };
}

export function findAssetById(
  assetId: string,
  systems: AssetSystem[] = MOCK_ASSET_SYSTEMS,
): { label: string; system: AssetSystem } | null {
  for (const system of systems) {
    if (system.id === assetId) {
      return { label: system.name, system };
    }
    const sub = system.subsystems.find((s) => s.id === assetId);
    if (sub) {
      return { label: `${system.name} › ${sub.name}`, system };
    }
  }
  return null;
}
