import type { AssetSystem } from "@/types/asset";

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

export function findAssetById(assetId: string): { label: string; system: AssetSystem } | null {
  for (const system of MOCK_ASSET_SYSTEMS) {
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
