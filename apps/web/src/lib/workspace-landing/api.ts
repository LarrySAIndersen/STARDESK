import { apiGet, apiPut } from "@/lib/api";
import type { WorkspaceLandingConfig, WorkspaceWidgetInstance } from "@/lib/workspace-landing/types";

type ApiWorkspaceWidgetInstance = {
  instance_id: string;
  kind: WorkspaceWidgetInstance["kind"];
  order: number;
  span: WorkspaceWidgetInstance["span"];
  hidden: boolean;
};

export type ApiWorkspaceLandingRead = {
  user_id: string;
  layout: {
    personal: ApiWorkspaceWidgetInstance[];
    team: ApiWorkspaceWidgetInstance[];
  };
  layout_version: number;
  updated_at: string;
};

export type WorkspaceLandingRecord = {
  userId: string;
  layout: WorkspaceLandingConfig;
  layoutVersion: number;
  updatedAt: string;
};

function toClientInstance(item: ApiWorkspaceWidgetInstance): WorkspaceWidgetInstance {
  return {
    instanceId: item.instance_id,
    kind: item.kind,
    order: item.order,
    span: item.span,
    hidden: item.hidden,
  };
}

function toApiInstance(item: WorkspaceWidgetInstance): ApiWorkspaceWidgetInstance {
  return {
    instance_id: item.instanceId,
    kind: item.kind,
    order: item.order,
    span: item.span,
    hidden: item.hidden,
  };
}

export function mapApiLayoutToClient(
  layout: ApiWorkspaceLandingRead["layout"],
): WorkspaceLandingConfig {
  return {
    personal: layout.personal.map(toClientInstance),
    team: layout.team.map(toClientInstance),
  };
}

function mapApiRecord(data: ApiWorkspaceLandingRead): WorkspaceLandingRecord {
  return {
    userId: data.user_id,
    layout: mapApiLayoutToClient(data.layout),
    layoutVersion: data.layout_version,
    updatedAt: data.updated_at,
  };
}

export async function fetchWorkspaceLandingFromApi(): Promise<WorkspaceLandingConfig | null> {
  const record = await fetchWorkspaceLandingRecord();
  return record?.layout ?? null;
}

export async function fetchWorkspaceLandingRecord(): Promise<WorkspaceLandingRecord | null> {
  try {
    const data = await apiGet<ApiWorkspaceLandingRead>("/api/v1/workspace/landing");
    return mapApiRecord(data);
  } catch {
    return null;
  }
}

export async function saveWorkspaceLandingToApi(config: WorkspaceLandingConfig): Promise<boolean> {
  try {
    await apiPut<ApiWorkspaceLandingRead>("/api/v1/workspace/landing", {
      layout: {
        personal: config.personal.map(toApiInstance),
        team: config.team.map(toApiInstance),
      },
    });
    return true;
  } catch {
    return false;
  }
}
