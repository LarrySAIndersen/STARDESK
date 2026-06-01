#!/usr/bin/env node
/**
 * Sync Sonar loop scheduler + watchdog status into Sonar Agent canvas sidecar.
 *
 * Reads reports/sonar-loop-last-tick.json, sonar-loop-scheduler.pid,
 * watchdog-latest.json, sonar-agent-latest.json and writes schedulerStatus
 * into canvases/stardesk-sonar-agent.canvas.data.json.
 *
 * Env:
 *   SONAR_CANVAS_DATA_PATH — override canvas.data.json path
 *   SONAR_TICK_INTERVAL_MINUTES — default 30
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveCanvasDataPath } from "./resolve-canvas-data-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "reports");
const CANVAS_STATE_KEY = "stardesk-sonar-agent-v1";
const DEFAULT_TICK_INTERVAL_MINUTES = 30;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readPid(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const pid = Number.parseInt(raw, 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err && typeof err === "object" && "code" in err && err.code === "EPERM";
  }
}

function parseIso(value) {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMinutes(iso, minutes) {
  const d = parseIso(iso);
  if (!d) return null;
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

function ageMinutes(iso) {
  const d = parseIso(iso);
  if (!d) return null;
  return (Date.now() - d.getTime()) / 60_000;
}

export function buildSchedulerStatus(options = {}) {
  const tickIntervalMinutes =
    Number.parseInt(process.env.SONAR_TICK_INTERVAL_MINUTES ?? "", 10) ||
    options.tickIntervalMinutes ||
    DEFAULT_TICK_INTERVAL_MINUTES;

  const lastTickFile = path.join(REPORTS_DIR, "sonar-loop-last-tick.json");
  const pidFile = path.join(REPORTS_DIR, "sonar-loop-scheduler.pid");
  const watchdogPidFile = path.join(REPORTS_DIR, "sonar-scheduler-watchdog.pid");
  const watchdogFile = path.join(REPORTS_DIR, "watchdog-latest.json");
  const sonarReportFile = path.join(REPORTS_DIR, "sonar-agent-latest.json");

  const lastTick = readJson(lastTickFile);
  const lastTickAt = lastTick?.at ?? null;
  const schedulerPid = readPid(pidFile) ?? (typeof lastTick?.pid === "number" ? lastTick.pid : null);
  const schedulerWatchdogPid = readPid(watchdogPidFile);

  const pidAlive = schedulerPid != null && isProcessAlive(schedulerPid);
  const schedulerWatchdogAlive =
    schedulerWatchdogPid != null && isProcessAlive(schedulerWatchdogPid);
  const tickAge = ageMinutes(lastTickAt);
  const tickFresh =
    tickAge != null && tickAge <= tickIntervalMinutes * 2 + 5;

  const schedulerRunning = pidAlive || (tickFresh && lastTick?.status === "ok");

  const watchdogDoc = readJson(watchdogFile);
  const watchdogLastCheckAt = watchdogDoc?.updated_at ?? null;
  const latestWatchdogEntry =
    Array.isArray(watchdogDoc?.history) && watchdogDoc.history.length > 0
      ? watchdogDoc.history[watchdogDoc.history.length - 1]
      : null;
  const watchdogSchedulerCheck = latestWatchdogEntry?.checks?.sonar_scheduler?.status ?? null;

  const sonarReport = readJson(sonarReportFile);
  const sonarScanAt = sonarReport?.generated_at ?? null;

  return {
    schedulerRunning,
    schedulerPid: schedulerPid ?? null,
    schedulerWatchdogRunning: schedulerWatchdogAlive,
    schedulerWatchdogPid: schedulerWatchdogPid ?? null,
    lastTickAt,
    nextTickAt: lastTickAt ? addMinutes(lastTickAt, tickIntervalMinutes) : null,
    tickIntervalMinutes,
    watchdogLastCheckAt,
    watchdogSchedulerStatus: watchdogSchedulerCheck,
    sonarScanAt,
    updatedAt: new Date().toISOString(),
  };
}

export function syncSchedulerToCanvas(options = {}) {
  const canvasDataPath = options.canvasDataPath || resolveCanvasDataPath();
  const schedulerStatus = buildSchedulerStatus(options);

  const canvasData = readJson(canvasDataPath) ?? {};
  const previous = canvasData[CANVAS_STATE_KEY] ?? {};

  const next = {
    ...previous,
    schedulerStatus,
    lastScanAt: previous.lastScanAt ?? schedulerStatus.sonarScanAt,
  };

  fs.mkdirSync(path.dirname(canvasDataPath), { recursive: true });
  fs.writeFileSync(
    canvasDataPath,
    `${JSON.stringify({ ...canvasData, [CANVAS_STATE_KEY]: next }, null, 2)}\n`,
    "utf8",
  );

  return { canvasDataPath, schedulerStatus };
}

function main() {
  const { canvasDataPath, schedulerStatus } = syncSchedulerToCanvas();
  const running = schedulerStatus.schedulerRunning ? "Kører" : "Stoppet";
  console.log(`Scheduler status synced → ${canvasDataPath}`);
  console.log(
    `Scheduler: ${running} · Sidste tick: ${schedulerStatus.lastTickAt ?? "—"} · Watchdog: ${schedulerStatus.watchdogLastCheckAt ?? "—"}`,
  );
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main();
}
