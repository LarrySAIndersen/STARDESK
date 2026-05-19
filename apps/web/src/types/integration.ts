export type IntegrationId = "slack" | "jira" | "topdesk";

/** Display status for sidebar and overview. */
export type IntegrationDisplayStatus = "active" | "inactive" | "draft";

export interface SlackIntegrationConfig {
  workspace_url: string;
  bot_token: string;
  default_channel: string;
  webhook_url: string;
  enabled: boolean;
}

export interface JiraIntegrationConfig {
  jira_url: string;
  email: string;
  api_token: string;
  project_key: string;
  enabled: boolean;
}

export interface TopdeskIntegrationConfig {
  topdesk_url: string;
  application_key: string;
  operator_group: string;
  enabled: boolean;
}

export type IntegrationConfigById = {
  slack: SlackIntegrationConfig;
  jira: JiraIntegrationConfig;
  topdesk: TopdeskIntegrationConfig;
};

export type IntegrationsState = IntegrationConfigById;

export interface IntegrationMeta {
  id: IntegrationId;
  name: string;
  description: string;
  href: string;
}
