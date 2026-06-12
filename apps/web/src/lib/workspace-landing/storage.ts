import { DEFAULT_WORKSPACE_LANDING } from "@/lib/workspace-landing/catalog";
import type { WorkspaceLandingConfig, WorkspaceWidgetInstance } from "@/lib/workspace-landing/types";

const STORAGE_PREFIX = "stardesk-workspace-landing:v1:";

export const WORKSPACE_LANDING_CHANGED_EVENT = "stardesk-workspace-landing-changed";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function normalizeInstances(raw: unknown): WorkspaceWidgetInstance[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: WorkspaceWidgetInstance[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Partial<WorkspaceWidgetInstance>;
    if (
      typeof record.instanceId !== "string" ||
      typeof record.kind !== "string" ||
      typeof record.order !== "number"
    ) {
      continue;
    }
    parsed.push({
      instanceId: record.instanceId,
      kind: record.kind as WorkspaceWidgetInstance["kind"],
      order: record.order,
      span: record.span === "half" ? "half" : "full",
      hidden: Boolean(record.hidden),
    });
  }
  return parsed.length > 0 ? parsed.sort((a, b) => a.order - b.order) : null;
}

export function readWorkspaceLanding(userId: string): WorkspaceLandingConfig {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_LANDING;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_WORKSPACE_LANDING;
    const parsed = JSON.parse(raw) as Partial<WorkspaceLandingConfig>;
    const personal = normalizeInstances(parsed.personal) ?? DEFAULT_WORKSPACE_LANDING.personal;
    const team = normalizeInstances(parsed.team) ?? DEFAULT_WORKSPACE_LANDING.team;
    return { personal, team };
  } catch {
    return DEFAULT_WORKSPACE_LANDING;
  }
}

export function writeWorkspaceLanding(userId: string, config: WorkspaceLandingConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(config));
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_LANDING_CHANGED_EVENT, { detail: { userId } }),
  );
}

export function resetWorkspaceLanding(userId: string): WorkspaceLandingConfig {
  writeWorkspaceLanding(userId, DEFAULT_WORKSPACE_LANDING);
  return DEFAULT_WORKSPACE_LANDING;
}
