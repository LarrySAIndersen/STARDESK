import { getGraphNeighborIds, MOCK_ASSET_EDGES } from "@/lib/asset-graph";
import { MOCK_ASSET_SYSTEMS } from "@/lib/mock-assets";
import type {
  AssetDetail,
  AssetEnvironment,
  AssetGraphEdge,
  AssetMetadataOverride,
  AssetStatus,
  AssetSystem,
} from "@/types/asset";

const OWNER_TEAMS = [
  "Platform Engineering",
  "Infrastruktur & Netværk",
  "Integration Services",
  "Forretnings-IT",
  "Sikkerhed & Compliance",
  "Drift & Observability",
] as const;

const DESCRIPTIONS: Record<string, string> = {
  "sys-star-platform":
    "Kerneplatform for STARDESK — portal, API og identitet samlet.",
  "sys-infrastruktur": "Underliggende netværk, database og DNS for STAR-miljøet.",
  "sys-integration": "Eksterne kanaler og beskedbroer til brugerne.",
  "sys-forretning": "Forretningskritiske applikationer og rapportering.",
  "sys-sikkerhed": "Identitetsstyring, adgangskontrol og sikkerhedsovervågning.",
  "sys-drift": "Backup, logning og alerting for driftsstabilitet.",
  "sub-auth": "OAuth/OIDC og sessionshåndtering for STARDESK.",
  "sub-portal": "Agent- og brugerportal (Next.js).",
  "sub-api": "REST API og integrationsendpoints.",
  "sub-netvaerk": "Firewall, load balancing og intern routing.",
  "sub-database": "Primær PostgreSQL-database (Neon).",
  "sub-dns": "Intern og ekstern DNS-zonehåndtering.",
  "sub-teams": "Microsoft Teams-notifikationer og bot.",
  "sub-slack": "Slack-workspace integration.",
  "sub-email": "SMTP-gateway til transaktionsmail.",
  "sub-erp": "ERP-integration mod økonomisystem.",
  "sub-crm": "Kunde- og kontaktoplysninger.",
  "sub-rapportering": "BI og ledelsesrapporter.",
  "sub-dokument": "Dokumentarkiv og vedhæftninger.",
  "sub-iam": "Rolle- og rettighedsmodel på tværs af STAR.",
  "sub-overvaagning": "SIEM og sikkerhedshændelser.",
  "sub-backup": "Daglige snapshots og gendannelsesplan.",
  "sub-logging": "Centraliseret applikations- og access-log.",
  "sub-alerting": "PagerDuty/Teams alerts ved incident.",
};

function hashStatus(id: string): AssetStatus {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  if (n % 11 === 0) return "Planlagt";
  if (n % 17 === 0) return "Nedlagt";
  return "I drift";
}

function hashEnvironment(id: string): AssetEnvironment {
  return id.includes("test") || id.charCodeAt(id.length - 1) % 7 === 0
    ? "Test"
    : "Produktion";
}

function lastUpdatedFor(id: string): string {
  const day = 3 + (id.length % 24);
  return `2026-04-${String(day).padStart(2, "0")}`;
}

function connectionEdgeIdsFor(assetId: string, edges: AssetGraphEdge[]): string[] {
  return edges
    .filter((e) => e.source === assetId || e.target === assetId)
    .map((e) => e.id);
}

function applyMetadataOverride(
  detail: AssetDetail,
  override: AssetMetadataOverride | undefined,
): AssetDetail {
  if (!override) return detail;
  return {
    ...detail,
    status: override.status ?? detail.status,
    ownerTeam: override.ownerTeam ?? detail.ownerTeam,
    environment: override.environment ?? detail.environment,
    description: override.description ?? detail.description,
    lastUpdated: override.lastUpdated ?? detail.lastUpdated,
  };
}

export function getAssetDetail(
  assetId: string,
  systems: AssetSystem[] = MOCK_ASSET_SYSTEMS,
  edges: AssetGraphEdge[] = MOCK_ASSET_EDGES,
  metadataOverrides: Record<string, AssetMetadataOverride> = {},
): AssetDetail | null {
  for (let i = 0; i < systems.length; i++) {
    const system = systems[i];
    if (system.id === assetId) {
      const related = [
        ...getGraphNeighborIds(assetId, edges),
        ...system.subsystems.map((s) => s.id),
      ];
      return applyMetadataOverride(
        {
          id: system.id,
          name: system.name,
          code: system.code,
          kind: "system",
          status: hashStatus(system.id),
          ownerTeam: OWNER_TEAMS[i % OWNER_TEAMS.length],
          environment: hashEnvironment(system.id),
          parentSystemId: null,
          parentSystemName: null,
          description:
            DESCRIPTIONS[system.id] ?? `Overordnet system: ${system.name}.`,
          relatedAssetIds: [...new Set(related)].filter((id) => id !== assetId),
          connectionEdgeIds: connectionEdgeIdsFor(assetId, edges),
          lastUpdated: lastUpdatedFor(system.id),
        },
        metadataOverrides[assetId],
      );
    }

    const sub = system.subsystems.find((s) => s.id === assetId);
    if (sub) {
      const related = getGraphNeighborIds(assetId, edges);
      return applyMetadataOverride(
        {
          id: sub.id,
          name: sub.name,
          code: sub.code,
          kind: "undersystem",
          status: hashStatus(sub.id),
          ownerTeam: OWNER_TEAMS[i % OWNER_TEAMS.length],
          environment: hashEnvironment(sub.id),
          parentSystemId: system.id,
          parentSystemName: system.name,
          description:
            DESCRIPTIONS[sub.id] ??
            `Undersystem under ${system.name} (${sub.code}).`,
          relatedAssetIds: [...related].filter((id) => id !== assetId),
          connectionEdgeIds: connectionEdgeIdsFor(assetId, edges),
          lastUpdated: lastUpdatedFor(sub.id),
        },
        metadataOverrides[sub.id],
      );
    }
  }
  return null;
}

export function getAssetLabel(
  assetId: string,
  systems: AssetSystem[] = MOCK_ASSET_SYSTEMS,
): string {
  const detail = getAssetDetail(assetId, systems);
  return detail?.name ?? assetId;
}
