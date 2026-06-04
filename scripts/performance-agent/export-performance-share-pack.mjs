#!/usr/bin/env node
/**
 * Export a self-contained performance share pack for colleagues (no repo/Cursor required).
 *
 *   npm --prefix scripts run perf:share
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PLAN_ITEMS } from "./performance-plan.mjs";
import { resolveCommandPath } from "../lib/script-security.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORT_DIR = path.join(REPO_ROOT, "reports");
const SHARE_ROOT = path.join(REPORT_DIR, "performance-share");
const SHARE_LATEST = path.join(SHARE_ROOT, "latest");
const ZIP_PATH = path.join(REPORT_DIR, "performance-share-pack.zip");

const SOURCE_FILES = {
  agentMd: path.join(REPORT_DIR, "performance-agent-latest.md"),
  agentJson: path.join(REPORT_DIR, "performance-agent-latest.json"),
  evidenceMd: path.join(REPORT_DIR, "performance-evidence-latest.md"),
  evidenceManifest: path.join(REPORT_DIR, "performance-evidence-manifest.json"),
  loadTest: path.join(REPORT_DIR, "performance-load-test-latest.json"),
  playwright: path.join(REPORT_DIR, "performance-playwright-latest.json"),
  jmeter: path.join(REPORT_DIR, "performance-jmeter-latest.json"),
  prerequisites: path.join(REPORT_DIR, "performance-prerequisites-latest.md"),
  benchmarkDb: path.join(REPORT_DIR, "performance-benchmark-db-latest.json"),
};

const SECRET_PATTERN =
  /(password|passwd|secret|token|authorization|database_url|api[_-]?key|bearer\s|Stardesk20\d+!|access_token|ep-[a-z0-9-]+)/i;

const TIER_ORDER = { KRITISK: 0, HØJ: 1, MEDIUM: 2, LAV: 3 };
const STATUS_ORDER = { breach: 0, partial: 1, ok: 2, not_measured: 3 };

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function sanitizeText(text) {
  if (!text) return text;
  return text
    .split("\n")
    .filter((line) => !SECRET_PATTERN.test(line))
    .join("\n")
    .replace(/sf\d+@example\.dk/gi, "[test-bruger]")
    .replace(/@[a-z0-9.-]+\.[a-z]{2,}/gi, (m) =>
      SECRET_PATTERN.test(m) ? "[email]" : m,
    );
}

function redactJson(value) {
  if (Array.isArray(value)) return value.map(redactJson);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = redactJson(v);
    }
    return out;
  }
  if (typeof value === "string" && SECRET_PATTERN.test(value)) {
    return "[REDACTED]";
  }
  return value;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileSafe(srcRel, destAbs) {
  const srcAbs = path.join(REPO_ROOT, srcRel.replace(/\//g, path.sep));
  if (!fs.existsSync(srcAbs)) return null;
  const st = fs.statSync(srcAbs);
  if (st.isDirectory()) return null;
  ensureDir(path.dirname(destAbs));
  fs.copyFileSync(srcAbs, destAbs);
  return path.relative(SHARE_LATEST, destAbs).replace(/\\/g, "/");
}

function formatMs(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(Number(n))}`;
}

function formatPct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toFixed(2)}%`;
}

function pickEnvironment(agent, prerequisitesText) {
  const web = agent?.playwright?.target ?? "http://localhost:3000";
  let api = "http://localhost:8000";
  let stardeskEnv = "test";
  const baseMatch = prerequisitesText?.match(/BASE_URL=(https?:\/\/[^\s`,]+)/);
  if (baseMatch) api = baseMatch[1];
  const envMatch = prerequisitesText?.match(/stardesk_env[=:]\s*"?([a-z-]+)"?/i);
  if (envMatch) stardeskEnv = envMatch[1];
  return { api, web, stardeskEnv, label: `API ${api}, Web ${web} (${stardeskEnv})` };
}

function collectRecommendations(agent) {
  const coverage = agent?.planCoverage ?? [];
  const ranked = coverage
    .filter((item) => item.measurable && (item.status === "breach" || item.status === "partial"))
    .sort((a, b) => {
      const ts = (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9);
      if (ts !== 0) return ts;
      return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    })
    .slice(0, 10);

  return ranked.map((item) => ({
    n: item.n,
    tier: item.tier,
    title: item.title,
    status: item.status,
    evidence: item.evidence ?? null,
    agent: item.agent,
  }));
}

function buildApiRows(agent) {
  const rows = [];
  const jmeter = agent?.jmeter;
  if (jmeter?.endpointStats) {
    for (const [endpoint, stats] of Object.entries(jmeter.endpointStats)) {
      rows.push({
        source: "JMeter",
        endpoint,
        count: stats.count,
        p95: stats.p95,
        errors: stats.errors ?? 0,
      });
    }
  }
  const load = agent?.loadTest;
  if (load?.endpointStats) {
    for (const [endpoint, stats] of Object.entries(load.endpointStats)) {
      rows.push({
        source: `Node load-test (${load.scenario ?? "—"})`,
        endpoint,
        count: stats.count,
        p95: stats.p95,
        errors: null,
      });
    }
  }
  return rows;
}

function buildUiRows(agent) {
  const pw = agent?.playwright;
  if (!pw?.scenarioStats) return [];
  return Object.entries(pw.scenarioStats).map(([id, s]) => ({
    id,
    label: pw.scenarios?.find((sc) => sc.id === id)?.label ?? id,
    wallP95: s.wallClockMs?.p95,
    lcpP95: s.lcpMs?.p95,
    thresholdMs: s.thresholdMs,
    errors: s.errors,
    pass: s.wallClockMs?.p95 <= s.thresholdMs && (s.errors ?? 0) === 0,
  }));
}

function collectThresholdBreaches(agent) {
  const out = [];
  for (const b of agent?.playwright?.thresholdBreaches ?? []) {
    out.push({ kind: "UI", text: b.replace(/\n/g, " ").trim() });
  }
  for (const b of agent?.loadTest?.thresholdBreaches ?? []) {
    out.push({ kind: "API load-test", text: b });
  }
  for (const b of agent?.jmeter?.thresholdBreaches ?? []) {
    out.push({ kind: "JMeter", text: b });
  }
  return out;
}

function mapRunMedia(playwright) {
  const byScenario = {};
  for (const run of playwright?.runs ?? []) {
    const id = run.id;
    if (!byScenario[id]) byScenario[id] = {};
    if (run.screenshot) byScenario[id].screenshot = run.screenshot;
  }
  const videos = playwright?.artifacts?.videos ?? [];
  const traces = playwright?.artifacts?.traces ?? [];
  const runIds = [...new Set((playwright?.runs ?? []).map((r) => r.id))];
  runIds.forEach((id, i) => {
    if (!byScenario[id]) byScenario[id] = {};
    if (videos[i]) byScenario[id].video = videos[i];
  });
  for (const tracePath of traces) {
    const base = path.basename(tracePath);
    const scenario = base.split("-iter")[0];
    if (!byScenario[scenario]) byScenario[scenario] = {};
    byScenario[scenario].trace = tracePath;
  }
  return byScenario;
}

function copyManifestArtifacts(manifest, artifactsDir) {
  const copied = [];
  for (const entry of manifest?.files ?? []) {
    if (!entry.exists || entry.isDirectory) continue;
    const rel = entry.path.replace(/\//g, path.sep);
    const dest = path.join(artifactsDir, rel.replace(/^artifacts[/\\]performance[/\\]?/i, ""));
    const relDest = copyFileSafe(entry.path, dest);
    if (relDest) copied.push({ ...entry, sharePath: `artifacts/${rel.replace(/^artifacts[/\\]performance[/\\]?/i, "").replace(/\\/g, "/")}` });
  }
  return copied;
}

function copyStampedReports(artifactsDir) {
  const reportsDir = path.join(artifactsDir, "reports");
  ensureDir(reportsDir);
  const names = [
    "performance-agent-latest.json",
    "performance-playwright-latest.json",
    "performance-load-test-latest.json",
    "performance-jmeter-latest.json",
  ];
  for (const name of names) {
    const src = path.join(REPORT_DIR, name);
    if (!fs.existsSync(src)) continue;
    const data = redactJson(JSON.parse(fs.readFileSync(src, "utf8")));
    fs.writeFileSync(path.join(reportsDir, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

function buildFindingsMarkdown(summary) {
  const lines = [];
  lines.push("# STARDESK — Performance fund (delbar)");
  lines.push("");
  lines.push(`**Genereret:** ${summary.generatedAt}`);
  lines.push(`**Resultat:** ${summary.pass ? "BESTÅET" : "IKKE BESTÅET"}`);
  lines.push(`**Miljø:** ${summary.environment.label}`);
  lines.push("");
  lines.push("## Opsummering");
  lines.push("");
  if (summary.playwright) {
    lines.push(
      `- **UI (Playwright):** ${summary.playwright.pass ? "OK" : "FEJL"} — ${summary.playwright.target}`,
    );
  }
  if (summary.loadTest) {
    lines.push(
      `- **API load-test:** ${summary.loadTest.pass ? "OK" : "FEJL"} — scenario \`${summary.loadTest.scenario}\`, p95 ${formatMs(summary.loadTest.p95Ms)} ms, fejlrate ${formatPct(summary.loadTest.errorRatePct)}`,
    );
  }
  if (summary.jmeter) {
    lines.push(`- **JMeter:** ${summary.jmeter.pass ? "OK" : "FEJL"}`);
  } else {
    lines.push("- **JMeter:** ikke kørt");
  }
  lines.push("");
  if (summary.apiRows.length) {
    lines.push("## API — p95 pr. endpoint");
    lines.push("");
    lines.push("| Kilde | Endpoint | Antal | p95 (ms) |");
    lines.push("|-------|----------|------:|---------:|");
    for (const row of summary.apiRows) {
      lines.push(`| ${row.source} | ${row.endpoint} | ${row.count} | ${formatMs(row.p95)} |`);
    }
    lines.push("");
  }
  if (summary.uiRows.length) {
    lines.push("## UI — scenarier");
    lines.push("");
    lines.push("| Scenario | p95 væg (ms) | Grænse (ms) | Status |");
    lines.push("|----------|-------------:|------------:|--------|");
    for (const row of summary.uiRows) {
      lines.push(
        `| ${row.label} | ${formatMs(row.wallP95)} | ${formatMs(row.thresholdMs)} | ${row.pass ? "OK" : "FEJL"} |`,
      );
    }
    lines.push("");
  }
  if (summary.thresholdBreaches.length) {
    lines.push("## Tærskel-brud");
    lines.push("");
    for (const b of summary.thresholdBreaches) {
      lines.push(`- **${b.kind}:** ${sanitizeText(b.text)}`);
    }
    lines.push("");
  }
  if (summary.recommendations.length) {
    lines.push("## Anbefalinger (performance-50)");
    lines.push("");
    for (const r of summary.recommendations) {
      lines.push(
        `- **#${r.n} (${r.tier})** ${r.title} — _${r.status}_${r.evidence ? `: ${sanitizeText(r.evidence)}` : ""}`,
      );
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("Åbn `index.html` i denne mappe for skærmbilleder og optagelser.");
  return lines.join("\n");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildIndexHtml(summary, mediaByScenario) {
  const statusClass = summary.pass ? "pass" : "fail";
  const statusLabel = summary.pass ? "BESTÅET" : "IKKE BESTÅET";

  const apiRowsHtml = summary.apiRows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.source)}</td><td>${escapeHtml(r.endpoint)}</td><td>${r.count}</td><td>${formatMs(r.p95)}</td></tr>`,
    )
    .join("");

  const uiRowsHtml = summary.uiRows
    .map((r) => {
      const ok = r.pass;
      return `<tr class="${ok ? "" : "breach"}"><td>${escapeHtml(r.label)}</td><td>${formatMs(r.wallP95)}</td><td>${formatMs(r.lcpP95)}</td><td>${formatMs(r.thresholdMs)}</td><td>${ok ? "OK" : "FEJL"}</td></tr>`;
    })
    .join("");

  const breachesHtml = summary.thresholdBreaches
    .map((b) => `<li><strong>${escapeHtml(b.kind)}:</strong> ${escapeHtml(sanitizeText(b.text))}</li>`)
    .join("");

  const recsHtml = summary.recommendations
    .map(
      (r) =>
        `<li><span class="tier">${escapeHtml(r.tier)}</span> <strong>#${r.n}</strong> ${escapeHtml(r.title)} — <em>${escapeHtml(r.status)}</em>${r.evidence ? `<br><small>${escapeHtml(sanitizeText(r.evidence))}</small>` : ""}</li>`,
    )
    .join("");

  const recordingsHtml = Object.entries(mediaByScenario)
    .map(([id, media]) => {
      const label = summary.uiRows.find((u) => u.id === id)?.label ?? id;
      const parts = [];
      if (media.shareScreenshot) {
        parts.push(
          `<figure><img src="${escapeHtml(media.shareScreenshot)}" alt="${escapeHtml(label)}"><figcaption>${escapeHtml(label)}</figcaption></figure>`,
        );
      }
      if (media.shareVideo) {
        parts.push(
          `<p><a href="${escapeHtml(media.shareVideo)}">Video (.webm)</a></p>`,
        );
      }
      if (media.shareTrace) {
        parts.push(
          `<p><a href="${escapeHtml(media.shareTrace)}">Playwright trace (.zip)</a></p>`,
        );
      }
      return `<section class="recording"><h3>${escapeHtml(label)}</h3>${parts.join("")}</section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>STARDESK Performance — delbar rapport</title>
  <style>
    :root { --ok: #166534; --fail: #991b1b; --bg: #f8fafc; --card: #fff; --border: #e2e8f0; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, sans-serif; margin: 0; padding: 1.5rem; background: var(--bg); color: #0f172a; line-height: 1.5; max-width: 1100px; margin-inline: auto; }
    h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
    h2 { font-size: 1.15rem; margin: 2rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
    .meta { color: #475569; font-size: 0.95rem; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600; font-size: 0.85rem; }
    .badge.pass { background: #dcfce7; color: var(--ok); }
    .badge.fail { background: #fee2e2; color: var(--fail); }
    table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin: 0.5rem 0 1rem; }
    th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #f1f5f9; font-size: 0.85rem; }
    tr.breach td { background: #fef2f2; }
    ul { padding-left: 1.25rem; }
    .recordings { display: grid; gap: 1.5rem; }
    .recording { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
    .recording img { max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 4px; }
    .tier { font-size: 0.75rem; background: #e0e7ff; padding: 0.1rem 0.35rem; border-radius: 3px; }
    footer { margin-top: 2rem; font-size: 0.8rem; color: #64748b; }
  </style>
</head>
<body>
  <header>
    <h1>STARDESK Performance</h1>
    <p class="meta">Genereret: ${escapeHtml(summary.generatedAt)} · Miljø: ${escapeHtml(summary.environment.label)}</p>
    <p><span class="badge ${statusClass}">${statusLabel}</span></p>
  </header>

  <section>
    <h2>Opsummering</h2>
    <ul>
      ${summary.playwright ? `<li>UI (Playwright): <strong>${summary.playwright.pass ? "OK" : "FEJL"}</strong> — ${escapeHtml(summary.playwright.target)}</li>` : "<li>UI (Playwright): ikke kørt</li>"}
      ${summary.loadTest ? `<li>API load-test: <strong>${summary.loadTest.pass ? "OK" : "FEJL"}</strong> — p95 ${formatMs(summary.loadTest.p95Ms)} ms, fejl ${formatPct(summary.loadTest.errorRatePct)}</li>` : "<li>API load-test: ikke kørt</li>"}
      <li>JMeter: ${summary.jmeter ? (summary.jmeter.pass ? "OK" : "FEJL") : "ikke kørt"}</li>
    </ul>
  </section>

  ${apiRowsHtml ? `<section><h2>API — p95 pr. endpoint</h2><table><thead><tr><th>Kilde</th><th>Endpoint</th><th>Antal</th><th>p95 (ms)</th></tr></thead><tbody>${apiRowsHtml}</tbody></table></section>` : ""}

  ${uiRowsHtml ? `<section><h2>UI — scenarier</h2><table><thead><tr><th>Scenario</th><th>Væg p95</th><th>LCP p95</th><th>Grænse</th><th>Status</th></tr></thead><tbody>${uiRowsHtml}</tbody></table></section>` : ""}

  ${breachesHtml ? `<section><h2>Tærskel-brud</h2><ul>${breachesHtml}</ul></section>` : ""}

  ${recsHtml ? `<section><h2>Anbefalinger</h2><ol>${recsHtml}</ol></section>` : ""}

  ${recordingsHtml ? `<section><h2>Optagelser</h2><div class="recordings">${recordingsHtml}</div></section>` : ""}

  <footer>STARDESK performance share pack — ingen adgangskoder eller hemmeligheder inkluderet.</footer>
</body>
</html>`;
}

function zipShareFolder(sourceDir, zipPath) {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  if (process.platform === "win32") {
    const cmd = `Compress-Archive -LiteralPath '${sourceDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;
    const r = spawnSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
      { stdio: "inherit" },
    );
    return (r.status ?? 1) === 0;
  }
  const zipExe = resolveCommandPath("zip");
  if (!zipExe) {
    console.warn("zip CLI unavailable — share folder created without .zip archive");
    return false;
  }
  const r = spawnSync(zipExe, ["-r", zipPath, "."], { cwd: sourceDir, stdio: "inherit", shell: false });
  if ((r.status ?? 1) !== 0) {
    console.warn("zip CLI failed — share folder created without .zip archive");
    return false;
  }
  return true;
}

/**
 * @returns {{ shareDir: string, zipPath: string | null, zipBytes: number | null }}
 */
export function buildPerformanceSharePack() {
  const agent = readJson(SOURCE_FILES.agentJson);
  if (!agent) {
    throw new Error(
      "Missing reports/performance-agent-latest.json — run perf:pipeline or perf:report first.",
    );
  }

  const manifest = readJson(SOURCE_FILES.evidenceManifest);
  const benchmarkDb = readJson(SOURCE_FILES.benchmarkDb);
  const prerequisitesRaw = readText(SOURCE_FILES.prerequisites);
  const prerequisitesText = prerequisitesRaw ? sanitizeText(prerequisitesRaw) : null;

  const stamp = (agent.generatedAt ?? new Date().toISOString()).replace(/[:.]/g, "-");
  const runDir = path.join(SHARE_ROOT, "runs", stamp);

  for (const dir of [SHARE_LATEST, runDir, path.join(SHARE_LATEST, "artifacts")]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
  ensureDir(SHARE_LATEST);
  ensureDir(path.join(SHARE_LATEST, "artifacts"));
  ensureDir(runDir);

  const artifactsDir = path.join(SHARE_LATEST, "artifacts");
  copyManifestArtifacts(manifest, artifactsDir);
  copyStampedReports(artifactsDir);

  const mediaByScenario = mapRunMedia(agent.playwright);
  for (const [scenarioId, media] of Object.entries(mediaByScenario)) {
    for (const key of ["screenshot", "video", "trace"]) {
      const rel = media[key];
      if (!rel) continue;
      const dest = path.join(artifactsDir, rel.replace(/^artifacts[/\\]performance[/\\]?/i, ""));
      const shareRel = copyFileSafe(rel, dest);
      if (shareRel) {
        media[`share${key.charAt(0).toUpperCase()}${key.slice(1)}`] = shareRel;
      }
    }
  }

  const environment = pickEnvironment(agent, prerequisitesText);
  const summary = {
    generatedAt: agent.generatedAt ?? new Date().toISOString(),
    pass: Boolean(agent.pass),
    constitution: agent.constitution ?? "STARDESK-performance-50.md",
    environment,
    playwright: agent.playwright
      ? {
          pass: Boolean(agent.playwright.pass),
          target: agent.playwright.target,
        }
      : null,
    jmeter: agent.jmeter
      ? { pass: Boolean(agent.jmeter.pass), target: agent.jmeter.target }
      : null,
    loadTest: agent.loadTest
      ? {
          pass:
            (agent.loadTest.thresholdBreaches?.length ?? 0) === 0 &&
            (agent.loadTest.totalErrors ?? 0) === 0,
          scenario: agent.loadTest.scenario,
          p95Ms: agent.loadTest.latencyMs?.p95,
          errorRatePct: agent.loadTest.errorRatePct,
        }
      : null,
    apiRows: buildApiRows(agent),
    uiRows: buildUiRows(agent),
    thresholdBreaches: collectThresholdBreaches(agent),
    recommendations: collectRecommendations(agent),
    planItemCount: PLAN_ITEMS.length,
    measurableSummary: agent.summary ?? null,
  };

  const findings = {
    ...summary,
    mediaByScenario,
    benchmarkDbRuns: benchmarkDb?.runs ?? null,
    benchmarkDbPersistedAt: benchmarkDb?.persistedAt ?? null,
    sources: {
      agentJson: fs.existsSync(SOURCE_FILES.agentJson),
      evidenceManifest: Boolean(manifest),
      playwright: fs.existsSync(SOURCE_FILES.playwright),
      loadTest: fs.existsSync(SOURCE_FILES.loadTest),
      jmeter: fs.existsSync(SOURCE_FILES.jmeter),
      benchmarkDb: Boolean(benchmarkDb),
    },
  };

  fs.writeFileSync(path.join(SHARE_LATEST, "findings.json"), `${JSON.stringify(findings, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(SHARE_LATEST, "FINDINGS.md"), `${buildFindingsMarkdown(summary)}\n`, "utf8");
  fs.writeFileSync(path.join(SHARE_LATEST, "index.html"), buildIndexHtml(summary, mediaByScenario), "utf8");

  const readme = `README — del med kollega

1. Åbn **index.html** i browseren (dobbeltklik) — komplet rapport med tabeller og skærmbilleder.
2. **FINDINGS.md** — kort tekst til Slack, mail eller Confluence.
3. **findings.json** — maskinlæsbar opsummering til scripts/dashboards.
4. Mappen **artifacts/** — videoer, traces og JSON-rapporter (relative stier i HTML).

Zip: reports/performance-share-pack.zip (hele latest-mappen).
`;
  fs.writeFileSync(path.join(SHARE_LATEST, "README-DEL-KOLLEGAER.md"), readme, "utf8");

  if (readText(SOURCE_FILES.agentMd)) {
    fs.writeFileSync(
      path.join(SHARE_LATEST, "performance-agent-latest.md"),
      sanitizeText(readText(SOURCE_FILES.agentMd)),
      "utf8",
    );
  }
  if (readText(SOURCE_FILES.evidenceMd)) {
    fs.writeFileSync(
      path.join(SHARE_LATEST, "performance-evidence-latest.md"),
      sanitizeText(readText(SOURCE_FILES.evidenceMd)),
      "utf8",
    );
  }

  copyTree(SHARE_LATEST, runDir);

  const zipped = zipShareFolder(SHARE_LATEST, ZIP_PATH);
  const zipBytes = zipped && fs.existsSync(ZIP_PATH) ? fs.statSync(ZIP_PATH).size : null;

  return {
    shareDir: SHARE_LATEST,
    indexHtml: path.join(SHARE_LATEST, "index.html"),
    zipPath: zipped ? ZIP_PATH : null,
    zipBytes,
    runDir,
  };
}

function copyTree(src, dest) {
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyTree(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  try {
    const result = buildPerformanceSharePack();
    console.log("Performance share pack ready.");
    console.log(`  Folder: ${path.relative(REPO_ROOT, result.shareDir)}`);
    console.log(`  HTML:   ${path.relative(REPO_ROOT, result.indexHtml)}`);
    if (result.zipPath && result.zipBytes != null) {
      const mb = (result.zipBytes / (1024 * 1024)).toFixed(2);
      console.log(`  Zip:    ${path.relative(REPO_ROOT, result.zipPath)} (${mb} MB)`);
    }
    console.log(`  Run archive: ${path.relative(REPO_ROOT, result.runDir)}`);
  } catch (err) {
    console.error(String(err?.message || err));
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
