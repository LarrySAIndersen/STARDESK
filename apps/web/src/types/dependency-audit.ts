export type DependencyEcosystem = "npm" | "pip";

export type OutdatedPackage = {
  package: string;
  version: string;
  latest?: string;
  path: string;
  ecosystem: DependencyEcosystem;
};

export type DependencyVulnerability = {
  package: string;
  version: string;
  severity: string;
  cve_ids: string[];
  cvss_score?: number;
  path: string;
  ecosystem: DependencyEcosystem;
};

export type WorkspaceModuleAudit = {
  id: string;
  label: string;
  path: string;
  ecosystem: DependencyEcosystem;
  last_audit_at: string;
  vulnerability_count: number;
  outdated_count: number;
};

export type DependencyAuditSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  outdated_count: number;
  cve_count: number;
};

export type DependencyAuditReport = {
  generated_at: string;
  cache_ttl_seconds: number;
  source: "live" | "cache" | "mock";
  summary: DependencyAuditSummary;
  outdated_packages: OutdatedPackage[];
  vulnerabilities: DependencyVulnerability[];
  workspace_modules: WorkspaceModuleAudit[];
  warnings?: string[];
  mock_banner?: string;
};
