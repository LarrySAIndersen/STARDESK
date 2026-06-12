import { apiGet, apiPut } from "@/lib/api";
import type { WorkspaceLandingConfig, WorkspaceWidgetInstance } from "@/lib/workspace-landing/types";

type ApiWorkspaceWidgetInstance = {
  instance_id: string;
  kind: WorkspaceWidgetInstance["kind"];
  order: number;
  span: WorkspaceWidgetInstance["span"];
  hidden: boolean;
};

type ApiWorkspaceLandingRead = {
  user_id: string;
  layout: {
    personal: ApiWorkspaceWidgetInstance[];
    team: ApiWorkspaceWidgetInstance[];
  };
  layout_version: number;
  updated_at: string;
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

export async function fetchWorkspaceLandingFromApi(): Promise<WorkspaceLandingConfig | null> {
  try {
    const data = await apiGet<ApiWorkspaceLandingRead>("/api/v1/workspace/landing");
    return mapApiLayoutToClient(data.layout);
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
