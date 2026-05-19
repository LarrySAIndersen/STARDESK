import type {
  IntegrationConfigById,
  IntegrationDisplayStatus,
  IntegrationId,
  IntegrationsState,
} from "@/types/integration";

export const INTEGRATIONS_STORAGE_KEY = "stardesk_integrations";
export const INTEGRATIONS_UPDATED_EVENT = "stardesk-integrations-updated";

export const INTEGRATION_META = [
  {
    id: "slack" as const,
    name: "Slack",
    description: "Forbind workspace med Slack OAuth og push sager direkte.",
    href: "/integrations/slack",
  },
  {
    id: "jira" as const,
    name: "Jira",
    description: "Synkroniser sager med Jira (kommer snart).",
    href: "/integrations/jira",
  },
  {
    id: "topdesk" as const,
    name: "TOPdesk",
    description: "Kobl sager til TOPdesk (kommer snart).",
    href: "/integrations/topdesk",
  },
] as const;

export const DEFAULT_INTEGRATIONS: IntegrationsState = {
  slack: {
    workspace_url: "",
    bot_token: "",
    default_channel: "",
    webhook_url: "",
    enabled: false,
  },
  jira: {
    jira_url: "",
    email: "",
    api_token: "",
    project_key: "",
    enabled: false,
  },
  topdesk: {
    topdesk_url: "",
    application_key: "",
    operator_group: "",
    enabled: false,
  },
};

function mergeState(partial: Partial<IntegrationsState> | null | undefined): IntegrationsState {
  if (!partial) {
    return { ...DEFAULT_INTEGRATIONS };
  }
  return {
    slack: { ...DEFAULT_INTEGRATIONS.slack, ...partial.slack },
    jira: { ...DEFAULT_INTEGRATIONS.jira, ...partial.jira },
    topdesk: { ...DEFAULT_INTEGRATIONS.topdesk, ...partial.topdesk },
  };
}

export function getDisplayStatus(
  id: IntegrationId,
  config: IntegrationConfigById[IntegrationId],
): IntegrationDisplayStatus {
  if (config.enabled) {
    return "active";
  }
  if (hasDraftConfig(id, config)) {
    return "draft";
  }
  return "inactive";
}

const hasDraftConfigById: {
  [K in IntegrationId]: (config: IntegrationConfigById[K]) => boolean;
} = {
  slack: (config) =>
    Boolean(
      config.workspace_url.trim() ||
        config.bot_token.trim() ||
        config.default_channel.trim() ||
        config.webhook_url.trim(),
    ),
  jira: (config) =>
    Boolean(
      config.jira_url.trim() ||
        config.email.trim() ||
        config.api_token.trim() ||
        config.project_key.trim(),
    ),
  topdesk: (config) =>
    Boolean(
      config.topdesk_url.trim() ||
        config.application_key.trim() ||
        config.operator_group.trim(),
    ),
};

export function hasDraftConfig<K extends IntegrationId>(
  id: K,
  config: IntegrationConfigById[K],
): boolean {
  return hasDraftConfigById[id](config);
}

export function displayStatusLabel(status: IntegrationDisplayStatus): string {
  switch (status) {
    case "active":
      return "Aktiv";
    case "draft":
      return "Kladde";
    case "inactive":
    default:
      return "Inaktiv";
  }
}

/** Short status label for the compact collapsed nav rail. */
export function displayStatusAbbrev(status: IntegrationDisplayStatus): string {
  switch (status) {
    case "active":
      return "Akt";
    case "draft":
      return "Kla";
    case "inactive":
    default:
      return "Ina";
  }
}

/** Slack mock: show Aktiv when enabled; otherwise Kladde/Konfigureret via draft. */
export function slackSidebarLabel(config: IntegrationsState["slack"]): string {
  const status = getDisplayStatus("slack", config);
  if (status === "active") {
    return "Aktiv";
  }
  if (status === "draft") {
    return "Konfigureret";
  }
  return "Inaktiv";
}

export function loadIntegrationsFromStorage(): IntegrationsState {
  if (typeof window === "undefined") {
    return mergeState(null);
  }
  try {
    const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
    if (!raw) {
      return mergeState(null);
    }
    return mergeState(JSON.parse(raw) as Partial<IntegrationsState>);
  } catch {
    return mergeState(null);
  }
}

export function saveIntegrationsToStorage(state: IntegrationsState): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(INTEGRATIONS_UPDATED_EVENT));
}

export function saveIntegrationPartial<K extends IntegrationId>(
  id: K,
  patch: Partial<IntegrationConfigById[K]>,
): IntegrationsState {
  const current = loadIntegrationsFromStorage();
  const next: IntegrationsState = {
    ...current,
    [id]: { ...current[id], ...patch },
  };
  saveIntegrationsToStorage(next);
  return next;
}

export function canEnableIntegration(id: IntegrationId): boolean {
  return id === "slack";
}
