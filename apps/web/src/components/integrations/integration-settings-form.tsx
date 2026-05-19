"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { IntegrationStatusPill } from "@/components/integrations/integration-status-pill";
import {
  canEnableIntegration,
  getDisplayStatus,
  loadIntegrationsFromStorage,
  saveIntegrationPartial,
  slackSidebarLabel,
} from "@/lib/integrations-config";
import type {
  IntegrationConfigById,
  IntegrationId,
  IntegrationsState,
} from "@/types/integration";

type FormProps<K extends IntegrationId> = {
  integrationId: K;
  title: string;
  children: (props: {
    values: IntegrationConfigById[K];
    onChange: <F extends keyof IntegrationConfigById[K]>(
      field: F,
      value: IntegrationConfigById[K][F],
    ) => void;
  }) => React.ReactNode;
};

function IntegrationSettingsFormShell<K extends IntegrationId>({
  integrationId,
  title,
  children,
}: FormProps<K>) {
  const [values, setValues] = useState<IntegrationConfigById[K]>(() =>
    loadIntegrationsFromStorage()[integrationId],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enableAttempt, setEnableAttempt] = useState(false);

  useEffect(() => {
    setValues(loadIntegrationsFromStorage()[integrationId]);
  }, [integrationId]);

  const onChange = useCallback(
    <F extends keyof IntegrationConfigById[K]>(
      field: F,
      value: IntegrationConfigById[K][F],
    ) => {
      setSaved(false);
      if (field === "enabled" && value === true && !canEnableIntegration(integrationId)) {
        setEnableAttempt(true);
        return;
      }
      setEnableAttempt(false);
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    [integrationId],
  );

  const status = getDisplayStatus(integrationId, values);
  const pillLabel =
    integrationId === "slack" ? slackSidebarLabel(values as IntegrationsState["slack"]) : undefined;
  const enableAllowed = canEnableIntegration(integrationId);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload = enableAttempt || !enableAllowed ? { ...values, enabled: false } : values;

    saveIntegrationPartial(integrationId, payload);
    try {
      await fetch(`/api/v1/integrations/${integrationId}`, {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // localStorage is source of truth for prototype
    }
    setValues(payload);
    setSaved(true);
    setEnableAttempt(false);
    setSaving(false);
  }

  const saveLabel =
    enableAttempt && !enableAllowed
      ? "Aktivér integration (kommer snart)"
      : "Gem indstillinger";

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <IntegrationStatusPill status={status} label={pillLabel} />
        <Link href="/integrations" className="text-star-navy text-xs font-semibold hover:underline">
          ← Alle integrationer
        </Link>
      </div>

      <div className="wire-card">
        <h2 className="wire-card-title">{title}</h2>
        {children({ values, onChange })}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-[var(--gray-border)]"
          checked={values.enabled}
          disabled={!enableAllowed}
          onChange={(e) => onChange("enabled", e.target.checked)}
        />
        <span className="font-semibold text-star-navy">Aktivér integration</span>
        {!enableAllowed ? (
          <span className="text-muted-foreground text-xs">(kommer snart)</span>
        ) : null}
      </label>

      {enableAttempt && !enableAllowed ? (
        <p className="text-muted-foreground text-xs">
          Integrationen kan gemmes som kladde, men aktivering er ikke tilgængelig endnu.
        </p>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {saved ? (
        <p className="text-[11px] font-semibold text-[#1a7a44]" role="status">
          Indstillinger gemt (prototype).
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          className="wire-btn wire-btn-primary"
          disabled={saving}
        >
          {saving ? "Gemmer…" : saveLabel}
        </button>
        <Link href="/integrations" className="wire-btn wire-btn-sm">
          Annuller
        </Link>
      </div>
    </form>
  );
}

export function SlackIntegrationSettingsForm() {
  return (
    <IntegrationSettingsFormShell integrationId="slack" title="Slack">
      {({ values, onChange }) => (
        <div className="space-y-3">
          <div>
            <label className="wire-form-label" htmlFor="slack-workspace">
              Workspace-URL
            </label>
            <input
              id="slack-workspace"
              type="url"
              className="wire-form-input h-9"
              placeholder="https://dit-workspace.slack.com"
              value={values.workspace_url}
              onChange={(e) => onChange("workspace_url", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="slack-token">
              Bot token
            </label>
            <input
              id="slack-token"
              type="password"
              autoComplete="off"
              className="wire-form-input h-9"
              value={values.bot_token}
              onChange={(e) => onChange("bot_token", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="slack-channel">
              Standardkanal
            </label>
            <input
              id="slack-channel"
              className="wire-form-input h-9"
              placeholder="#support"
              value={values.default_channel}
              onChange={(e) => onChange("default_channel", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="slack-webhook">
              Webhook-URL (valgfrit)
            </label>
            <input
              id="slack-webhook"
              type="url"
              className="wire-form-input h-9"
              value={values.webhook_url}
              onChange={(e) => onChange("webhook_url", e.target.value)}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Push fra sagsdetaljer bruger stadig mock-kanaler indtil backend er koblet på.
          </p>
        </div>
      )}
    </IntegrationSettingsFormShell>
  );
}

export function JiraIntegrationSettingsForm() {
  return (
    <IntegrationSettingsFormShell integrationId="jira" title="Jira">
      {({ values, onChange }) => (
        <div className="space-y-3">
          <div>
            <label className="wire-form-label" htmlFor="jira-url">
              Jira-URL
            </label>
            <input
              id="jira-url"
              type="url"
              className="wire-form-input h-9"
              placeholder="https://dit-domæne.atlassian.net"
              value={values.jira_url}
              onChange={(e) => onChange("jira_url", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="jira-email">
              Servicekonto e-mail
            </label>
            <input
              id="jira-email"
              type="email"
              className="wire-form-input h-9"
              value={values.email}
              onChange={(e) => onChange("email", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="jira-token">
              API-token
            </label>
            <input
              id="jira-token"
              type="password"
              autoComplete="off"
              className="wire-form-input h-9"
              value={values.api_token}
              onChange={(e) => onChange("api_token", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="jira-project">
              Projekt-nøgle
            </label>
            <input
              id="jira-project"
              className="wire-form-input h-9"
              placeholder="SD"
              value={values.project_key}
              onChange={(e) => onChange("project_key", e.target.value)}
            />
          </div>
        </div>
      )}
    </IntegrationSettingsFormShell>
  );
}

export function TopdeskIntegrationSettingsForm() {
  return (
    <IntegrationSettingsFormShell integrationId="topdesk" title="TOPdesk">
      {({ values, onChange }) => (
        <div className="space-y-3">
          <div>
            <label className="wire-form-label" htmlFor="topdesk-url">
              TOPdesk-URL
            </label>
            <input
              id="topdesk-url"
              type="url"
              className="wire-form-input h-9"
              placeholder="https://dit-domæne.topdesk.net"
              value={values.topdesk_url}
              onChange={(e) => onChange("topdesk_url", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="topdesk-key">
              Applikationsnøgle
            </label>
            <input
              id="topdesk-key"
              type="password"
              autoComplete="off"
              className="wire-form-input h-9"
              value={values.application_key}
              onChange={(e) => onChange("application_key", e.target.value)}
            />
          </div>
          <div>
            <label className="wire-form-label" htmlFor="topdesk-group">
              Operatørgruppe
            </label>
            <input
              id="topdesk-group"
              className="wire-form-input h-9"
              placeholder="STAR Service Desk"
              value={values.operator_group}
              onChange={(e) => onChange("operator_group", e.target.value)}
            />
          </div>
        </div>
      )}
    </IntegrationSettingsFormShell>
  );
}
