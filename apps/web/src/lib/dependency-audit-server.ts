import "server-only";

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import type { DependencyAuditReport } from "@/types/dependency-audit";

function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

export function auditReportPath(): string {
  return path.join(repoRoot(), "reports", "dependency-audit-latest.json");
}

export function auditScriptPath(): string {
  return path.join(repoRoot(), "scripts", "security-audit", "run-audit.mjs");
}

function readReportFile(): DependencyAuditReport | null {
  const file = auditReportPath();
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as DependencyAuditReport;
  } catch {
    return null;
  }
}

function isCacheFresh(report: DependencyAuditReport): boolean {
  const ttl = (report.cache_ttl_seconds ?? 3600) * 1000;
  const age = Date.now() - new Date(report.generated_at).getTime();
  return age >= 0 && age < ttl;
}

export function getCachedAuditReport(): DependencyAuditReport | null {
  const report = readReportFile();
  if (!report) return null;
  return { ...report, source: "cache" };
}

export function getAuditReportPreferCache(): DependencyAuditReport | null {
  const report = getCachedAuditReport();
  if (!report || !isCacheFresh(report)) return null;
  return report;
}

export function mockAuditReport(): DependencyAuditReport {
  const now = new Date().toISOString();
  return {
    generated_at: now,
    cache_ttl_seconds: 3600,
    source: "mock",
    mock_banner: "Kør lokalt: npm run security:audit (fra scripts/)",
    summary: {
      critical: 0,
      high: 1,
      medium: 1,
      low: 0,
      info: 0,
      outdated_count: 1,
      cve_count: 1,
    },
    outdated_packages: [
      {
        package: "example-lib",
        version: "1.2.3",
        latest: "1.4.0",
        path: "apps/web",
        ecosystem: "npm",
      },
    ],
    vulnerabilities: [
      {
        package: "example-lib",
        version: "1.2.3",
        severity: "high",
        cve_ids: ["CVE-2024-00000"],
        cvss_score: 7.5,
        path: "apps/web → example-lib",
        ecosystem: "npm",
      },
    ],
    workspace_modules: [
      {
        id: "apps/web",
        label: "STARdesk web (Next.js)",
        path: "apps/web",
        ecosystem: "npm",
        last_audit_at: now,
        vulnerability_count: 1,
        outdated_count: 1,
      },
      {
        id: "apps/api",
        label: "STARdesk API (FastAPI)",
        path: "apps/api",
        ecosystem: "pip",
        last_audit_at: now,
        vulnerability_count: 0,
        outdated_count: 0,
      },
      {
        id: "scripts",
        label: "scripts (værktøjer)",
        path: "scripts",
        ecosystem: "npm",
        last_audit_at: now,
        vulnerability_count: 0,
        outdated_count: 0,
      },
    ],
    warnings: ["Eksempeldata — kør security:audit for rigtige resultater"],
  };
}

export function runAuditScript(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const script = auditScriptPath();
    if (!fs.existsSync(script)) {
      resolve({ ok: false, error: "Audit-script ikke fundet" });
      return;
    }
    const child = spawn(process.execPath, [script], {
      cwd: path.join(repoRoot(), "scripts"),
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        resolve({ ok: false, error: stderr.trim() || `Exit ${code}` });
      }
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

export async function refreshAuditReport(
  force = false,
): Promise<{ report: DependencyAuditReport; refreshed: boolean }> {
  if (!force) {
    const cached = getAuditReportPreferCache();
    if (cached) return { report: cached, refreshed: false };
  }

  const run = await runAuditScript();
  const fromFile = readReportFile();
  if (fromFile) {
    return { report: { ...fromFile, source: run.ok ? "live" : "cache" }, refreshed: run.ok };
  }

  const mock = mockAuditReport();
  if (!run.ok) {
    mock.warnings = [
      ...(mock.warnings ?? []),
      run.error ? `Audit CLI: ${run.error}` : "Audit CLI kunne ikke køres",
    ];
  }
  return { report: mock, refreshed: false };
}
