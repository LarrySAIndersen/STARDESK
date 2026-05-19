#!/usr/bin/env node
/**
 * Dependency & CVE audit for STARDESK monorepo.
 * Writes reports/dependency-audit-latest.json (gitignored).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const REPORT_FILE = path.join(REPORT_DIR, "dependency-audit-latest.json");

const WORKSPACE_MODULES = [
  { id: "apps/web", name: "apps/web", label: "STARdesk web (Next.js)", ecosystem: "npm" },
  { id: "apps/api", name: "apps/api", label: "STARdesk API (FastAPI)", ecosystem: "pip" },
  { id: "scripts", name: "scripts", label: "scripts (værktøjer)", ecosystem: "npm" },
];

const SEVERITY_CVSS_FALLBACK = {
  critical: 9.5,
  high: 7.5,
  moderate: 5.5,
  medium: 5.5,
  low: 2.5,
  info: 0,
};

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function hasPackageJson(dir) {
  return fs.existsSync(path.join(dir, "package.json"));
}

function parseJsonSafe(text) {
  if (!text?.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeSeverity(raw) {
  const s = String(raw ?? "info").toLowerCase();
  if (s === "moderate") return "medium";
  return s;
}

function cvssFromSeverity(severity) {
  return SEVERITY_CVSS_FALLBACK[normalizeSeverity(severity)] ?? 0;
}

function extractCvssFromVia(via) {
  if (!via || typeof via !== "object") return null;
  const scores = [];
  for (const key of ["cvss", "cvssV3", "cvssV2"]) {
    const block = via[key];
    if (!block) continue;
    if (typeof block === "number") scores.push(block);
    if (typeof block?.score === "number") scores.push(block.score);
    if (typeof block?.baseScore === "number") scores.push(block.baseScore);
  }
  return scores.length ? Math.max(...scores) : null;
}

function collectCveIds(viaList) {
  const ids = new Set();
  for (const via of viaList ?? []) {
    if (typeof via === "string") {
      if (/^CVE-\d{4}-\d+$/i.test(via)) ids.add(via.toUpperCase());
      continue;
    }
    if (via?.cve) ids.add(String(via.cve).toUpperCase());
    if (via?.name && /^CVE-\d{4}-\d+$/i.test(via.name)) {
      ids.add(via.name.toUpperCase());
    }
    const url = via?.url ?? "";
    const m = url.match(/CVE-\d{4}-\d+/i);
    if (m) ids.add(m[0].toUpperCase());
  }
  return [...ids];
}

function parseNpmAudit(auditJson, workspacePath) {
  const vulnerabilities = [];
  const vulnMap = auditJson?.vulnerabilities ?? {};
  for (const entry of Object.values(vulnMap)) {
    if (!entry || typeof entry !== "object") continue;
    const name = entry.name ?? "unknown";
    const severity = normalizeSeverity(entry.severity);
    const viaList = entry.via ?? [];
    const cve_ids = collectCveIds(viaList);
    let cvss_score = null;
    for (const via of viaList) {
      if (typeof via === "object") {
        const score = extractCvssFromVia(via);
        if (score != null) cvss_score = Math.max(cvss_score ?? 0, score);
      }
    }
    if (cvss_score == null) cvss_score = cvssFromSeverity(severity);
    vulnerabilities.push({
      package: name,
      version: entry.range ?? entry.version ?? "",
      severity,
      cve_ids,
      cvss_score,
      path: `${workspacePath} → ${name}`,
      ecosystem: "npm",
    });
  }
  return vulnerabilities;
}

function parseNpmOutdated(outdatedJson, workspacePath) {
  const outdated = [];
  if (!outdatedJson || typeof outdatedJson !== "object") return outdated;
  for (const [name, info] of Object.entries(outdatedJson)) {
    if (!info || typeof info !== "object") continue;
    outdated.push({
      package: name,
      version: info.current ?? "",
      latest: info.latest ?? info.wanted ?? undefined,
      path: workspacePath,
      ecosystem: "npm",
    });
  }
  return outdated;
}

function auditNpmWorkspace(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!hasPackageJson(abs)) {
    return { outdated: [], vulnerabilities: [], notes: ["Ingen package.json"] };
  }
  const outdatedRun = run("npm", ["outdated", "--json"], abs);
  const auditRun = run("npm", ["audit", "--json"], abs);
  const outdatedJson = parseJsonSafe(outdatedRun.stdout);
  const auditJson = parseJsonSafe(auditRun.stdout);
  const notes = [];
  if (!outdatedRun.ok && outdatedRun.status !== 1) {
    notes.push(`npm outdated fejlede (exit ${outdatedRun.status})`);
  }
  if (!auditRun.ok && !auditJson) {
    notes.push(`npm audit fejlede (exit ${auditRun.status})`);
  }
  return {
    outdated: parseNpmOutdated(outdatedJson, relPath),
    vulnerabilities: auditJson ? parseNpmAudit(auditJson, relPath) : [],
    notes,
  };
}

function parsePipAuditJson(data, workspacePath) {
  const vulnerabilities = [];
  const outdated = [];
  const deps = Array.isArray(data) ? data : data?.dependencies ?? data?.vulnerabilities ?? [];
  for (const item of deps) {
    if (!item || typeof item !== "object") continue;
    const name = item.name ?? item.package ?? "unknown";
    const version = item.version ?? item.installed_version ?? "";
    const vulns = item.vulns ?? item.vulnerabilities ?? (item.id ? [item] : []);
    if (vulns.length === 0 && item.fix_versions) {
      outdated.push({
        package: name,
        version,
        latest: item.fix_versions?.[0],
        path: workspacePath,
        ecosystem: "pip",
      });
      continue;
    }
    for (const v of vulns) {
      const cve_ids = [];
      for (const id of v.aliases ?? v.cve ?? []) {
        if (/^CVE-/i.test(String(id))) cve_ids.push(String(id).toUpperCase());
      }
      if (v.id && /^CVE-/i.test(v.id)) cve_ids.push(String(v.id).toUpperCase());
      const severity = normalizeSeverity(v.severity ?? "medium");
      let cvss_score = null;
      if (Array.isArray(v.cvss)) {
        for (const c of v.cvss) {
          if (typeof c?.score === "number") {
            cvss_score = Math.max(cvss_score ?? 0, c.score);
          }
        }
      }
      if (cvss_score == null) cvss_score = cvssFromSeverity(severity);
      vulnerabilities.push({
        package: name,
        version,
        severity,
        cve_ids: [...new Set(cve_ids)],
        cvss_score,
        path: `${workspacePath} → ${name}`,
        ecosystem: "pip",
      });
    }
  }
  return { outdated, vulnerabilities };
}

function auditPipWorkspace(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  const reqFile = ["requirements.txt", "pyproject.toml"]
    .map((f) => path.join(abs, f))
    .find((p) => fs.existsSync(p));
  if (!reqFile) {
    return { outdated: [], vulnerabilities: [], notes: ["Ingen Python-afhængighedsfil"] };
  }
  const pipAudit = run("pip", ["audit", "--format", "json"], abs);
  if (pipAudit.stdout) {
    const parsed = parseJsonSafe(pipAudit.stdout);
    if (parsed) {
      const { outdated, vulnerabilities } = parsePipAuditJson(parsed, relPath);
      return { outdated, vulnerabilities, notes: [] };
    }
  }
  const uvAudit = run("uv", ["pip", "audit", "--format", "json"], abs);
  if (uvAudit.stdout) {
    const parsed = parseJsonSafe(uvAudit.stdout);
    if (parsed) {
      const { outdated, vulnerabilities } = parsePipAuditJson(parsed, relPath);
      return { outdated, vulnerabilities, notes: [] };
    }
  }
  return {
    outdated: [],
    vulnerabilities: [],
    notes: [
      "pip audit / uv pip audit ikke tilgængelig — kør manuelt i apps/api eller installer pip-audit",
    ],
  };
}

function summarize(vulnerabilities, outdated) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const v of vulnerabilities) {
    const score = v.cvss_score ?? cvssFromSeverity(v.severity);
    if (score >= 9) counts.critical += 1;
    else if (score >= 7) counts.high += 1;
    else if (score >= 4) counts.medium += 1;
    else if (score > 0) counts.low += 1;
    else counts.info += 1;
  }
  return {
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    info: counts.info,
    outdated_count: outdated.length,
    cve_count: vulnerabilities.filter((v) => v.cve_ids?.length).length,
  };
}

function buildReport() {
  const outdated_packages = [];
  const vulnerabilities = [];
  const workspace_modules = [];
  const warnings = [];

  for (const mod of WORKSPACE_MODULES) {
    const audited_at = new Date().toISOString();
    let result;
    if (mod.ecosystem === "npm") {
      result = auditNpmWorkspace(mod.name);
    } else {
      result = auditPipWorkspace(mod.name);
    }
    outdated_packages.push(...result.outdated);
    vulnerabilities.push(...result.vulnerabilities);
    if (result.notes?.length) warnings.push(...result.notes.map((n) => `${mod.name}: ${n}`));
    workspace_modules.push({
      id: mod.id,
      label: mod.label,
      path: mod.name,
      ecosystem: mod.ecosystem,
      last_audit_at: audited_at,
      vulnerability_count: result.vulnerabilities.length,
      outdated_count: result.outdated.length,
    });
  }

  const summary = summarize(vulnerabilities, outdated_packages);

  return {
    generated_at: new Date().toISOString(),
    cache_ttl_seconds: 3600,
    source: "live",
    summary,
    outdated_packages,
    vulnerabilities,
    workspace_modules,
    warnings,
  };
}

function main() {
  const report = buildReport();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${REPORT_FILE}`);
  console.log(
    `Summary: ${report.summary.critical} critical, ${report.summary.high} high, ` +
      `${report.summary.outdated_count} outdated`,
  );
}

main();
