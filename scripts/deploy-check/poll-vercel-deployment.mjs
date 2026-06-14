#!/usr/bin/env node
/**
 * Poll Vercel deployments until READY or timeout.
 *
 * Usage: node poll-vercel-deployment.mjs <staging|production> [--json]
 *
 * Env: VERCEL_TOKEN (required), VERCEL_TEAM_ID (optional)
 */
import { resolveTarget } from "./targets.mjs";

const TEAM = process.env.VERCEL_TEAM_ID ?? "team_kjaerby-1628s-projects";
const TOKEN = process.env.VERCEL_TOKEN?.trim();
const MAX_WAIT_MS = Number(process.env.DEPLOY_CHECK_MAX_WAIT_MS ?? 600_000);
const POLL_MS = Number(process.env.DEPLOY_CHECK_POLL_MS ?? 15_000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function vercelFetch(path) {
  const url = `https://api.vercel.com${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function latestDeployment(project, branch) {
  const teamQ = TEAM ? `&teamId=${encodeURIComponent(TEAM)}` : "";
  const data = await vercelFetch(
    `/v6/deployments?projectId=${encodeURIComponent(project)}&limit=5&target=production${teamQ}`,
  );
  let deployments = data.deployments ?? [];
  if (branch !== "main") {
    const preview = await vercelFetch(
      `/v6/deployments?projectId=${encodeURIComponent(project)}&limit=10${teamQ}`,
    );
    deployments = [...(preview.deployments ?? []), ...deployments];
  }
  const match = deployments.find((d) => {
    const meta = d.meta ?? {};
    const ref = meta.githubCommitRef ?? meta.gitCommitRef ?? "";
    return ref === branch || d.name?.includes(branch);
  });
  return match ?? deployments[0] ?? null;
}

async function resolveProjectId(name) {
  const teamQ = TEAM ? `?teamId=${encodeURIComponent(TEAM)}` : "";
  const data = await vercelFetch(`/v9/projects/${encodeURIComponent(name)}${teamQ}`);
  return data.id ?? name;
}

async function pollProject(projectName, branch) {
  const projectId = await resolveProjectId(projectName);
  const deadline = Date.now() + MAX_WAIT_MS;
  let last = null;

  while (Date.now() < deadline) {
    last = await latestDeployment(projectId, branch);
    if (!last) {
      await sleep(POLL_MS);
      continue;
    }
    const state = last.readyState ?? last.state ?? "UNKNOWN";
    if (state === "READY") {
      return {
        project: projectName,
        projectId,
        deploymentId: last.uid ?? last.id,
        url: `https://${last.url}`,
        state,
        createdAt: last.createdAt ?? last.created,
        branch,
      };
    }
    if (state === "ERROR" || state === "CANCELED") {
      return {
        project: projectName,
        projectId,
        deploymentId: last.uid ?? last.id,
        url: last.url ? `https://${last.url}` : null,
        state,
        error: last.errorMessage ?? "Vercel deployment failed",
        branch,
      };
    }
    await sleep(POLL_MS);
  }

  return {
    project: projectName,
    projectId,
    deploymentId: last?.uid ?? last?.id ?? null,
    url: last?.url ? `https://${last.url}` : null,
    state: "TIMEOUT",
    error: `Deployment not READY within ${MAX_WAIT_MS / 1000}s`,
    branch,
  };
}

async function main() {
  const targetName = process.argv[2] ?? "staging";
  const jsonOut = process.argv.includes("--json");
  const { branch, vercelProjects } = resolveTarget(targetName);

  if (!TOKEN) {
    const skip = {
      skipped: true,
      reason: "VERCEL_TOKEN not set — skipping Vercel poll",
      target: targetName,
      branch,
    };
    if (jsonOut) {
      console.log(JSON.stringify(skip, null, 2));
      process.exit(0);
    }
    console.warn(skip.reason);
    process.exit(0);
  }

  const results = [];
  for (const project of vercelProjects) {
    results.push(await pollProject(project, branch));
  }

  const payload = {
    at: new Date().toISOString(),
    target: targetName,
    branch,
    deployments: results,
    allReady: results.every((r) => r.state === "READY"),
    anyError: results.some((r) => r.state === "ERROR" || r.state === "CANCELED" || r.state === "TIMEOUT"),
  };

  if (jsonOut) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(payload.allReady ? 0 : 1);
  }

  for (const r of results) {
    console.log(`${r.project}: ${r.state} ${r.url ?? ""} ${r.error ?? ""}`.trim());
  }
  process.exit(payload.allReady ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
