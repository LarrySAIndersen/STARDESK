import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parse JMeter CSV JTL output (saveTimes=true, saveLabels=true).
 * @param {string} jtlPath
 */
export function parseJtlFile(jtlPath) {
  const raw = readFileSync(jtlPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return { samples: [], byLabel: {}, summary: emptySummary() };
  }

  const header = lines[0].split(",");
  const idx = (name) => header.indexOf(name);

  const labelIdx = idx("label");
  const elapsedIdx = idx("elapsed");
  const successIdx = idx("success");
  const codeIdx = idx("responseCode");

  const samples = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < header.length) continue;
    samples.push({
      label: cols[labelIdx] ?? "unknown",
      elapsedMs: Number.parseFloat(cols[elapsedIdx] ?? "0"),
      success: String(cols[successIdx]).toLowerCase() === "true",
      responseCode: cols[codeIdx] ?? "0",
    });
  }

  const byLabel = {};
  for (const sample of samples) {
    if (!byLabel[sample.label]) {
      byLabel[sample.label] = { latencies: [], errors: 0, count: 0 };
    }
    const bucket = byLabel[sample.label];
    bucket.count += 1;
    bucket.latencies.push(sample.elapsedMs);
    if (!sample.success) bucket.errors += 1;
  }

  const endpointStats = {};
  for (const [label, bucket] of Object.entries(byLabel)) {
    const sorted = [...bucket.latencies].sort((a, b) => a - b);
    endpointStats[label] = {
      count: bucket.count,
      errors: bucket.errors,
      errorRatePct: bucket.count ? Number(((bucket.errors / bucket.count) * 100).toFixed(3)) : 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  const allLatencies = samples.map((s) => s.elapsedMs).sort((a, b) => a - b);
  const totalErrors = samples.filter((s) => !s.success).length;

  return {
    samples,
    byLabel: endpointStats,
    summary: {
      totalRequests: samples.length,
      totalErrors,
      errorRatePct: samples.length
        ? Number(((totalErrors / samples.length) * 100).toFixed(3))
        : 0,
      latencyMs: {
        p50: percentile(allLatencies, 50),
        p95: percentile(allLatencies, 95),
        p99: percentile(allLatencies, 99),
      },
    },
  };
}

function emptySummary() {
  return {
    totalRequests: 0,
    totalErrors: 0,
    errorRatePct: 0,
    latencyMs: { p50: 0, p95: 0, p99: 0 },
  };
}

function percentile(sorted, pct) {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1),
  );
  return Number(sorted[index].toFixed(2));
}

/** Minimal CSV line parser (handles quoted fields). */
function parseCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

export function writeUsersCsv(users, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const lines = ["email,password"];
  for (const user of users) {
    const email = String(user.email).replace(/"/g, '""');
    const password = String(user.password).replace(/"/g, '""');
    lines.push(`"${email}","${password}"`);
  }
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
}

export function resolveJmeterDir() {
  return resolve(__dirname, "jmeter");
}
