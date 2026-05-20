"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IntegrationStatusPill } from "@/components/integrations/integration-status-pill";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatIntegrationError } from "@/lib/format-integration-error";
import type { SlackChannel, SlackStatus } from "@/types/slack";

function channelLabel(channel: SlackChannel): string {
  return `${channel.is_private ? "🔒" : "#"}${channel.name}`;
}

function statusFromSlack(status: SlackStatus): "active" | "draft" | "inactive" {
  if (status.connected && status.enabled) {
    return "active";
  }
  if (status.connected) {
    return "draft";
  }
  return "inactive";
}

export function SlackIntegrationSettings() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusPill = useMemo(
    () => (status ? statusFromSlack(status) : "inactive"),
    [status],
  );
  const statusLabel = useMemo(() => {
    if (!status) {
      return "Ikke forbundet";
    }
    if (status.connected && status.enabled) {
      return "Aktiv";
    }
    if (status.connected) {
      return "Forbundet";
    }
    return "Ikke forbundet";
  }, [status]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<SlackStatus>("/api/v1/integrations/slack/status");
      setStatus(next);
      setSelectedChannelId(next.default_channel_id ?? "");
      setWebhookUrl(next.webhook_url ?? "");
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke hente Slack-status",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const list = await apiGet<SlackChannel[]>("/api/v1/integrations/slack/channels");
      setChannels(list);
      if (!selectedChannelId && list.length > 0) {
        setSelectedChannelId(list[0]!.channel_id);
      }
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke hente Slack-kanaler",
        ),
      );
    }
  }, [selectedChannelId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setNotice("Slack er nu forbundet.");
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(`Slack OAuth fejlede: ${oauthError}`);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!status?.connected) {
      setChannels([]);
      return;
    }
    void loadChannels();
  }, [status?.connected, loadChannels]);

  async function saveSettings() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await apiPatch<SlackStatus>("/api/v1/integrations/slack/settings", {
        enabled: status?.connected ? status.enabled : false,
        default_channel_id: selectedChannelId,
        webhook_url: webhookUrl,
      });
      setStatus(next);
      setNotice("Slack-indstillinger gemt.");
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke gemme Slack-indstillinger",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await apiPost<SlackStatus>("/api/v1/integrations/slack/disconnect", {});
      setStatus(next);
      setChannels([]);
      setSelectedChannelId("");
      setNotice("Slack er frakoblet.");
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke frakoble Slack",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <IntegrationStatusPill status={statusPill} label={statusLabel} />
        <Link href="/integrations" className="text-star-navy text-xs font-semibold hover:underline">
          ← Alle integrationer
        </Link>
      </div>

      <div className="wire-card space-y-4">
        <h2 className="wire-card-title">Slack</h2>
        <p className="text-muted-foreground text-xs">
          Forbind STARdesk med Slack via OAuth. Bot-token gemmes kun på serveren.
        </p>

        {status?.connected ? (
          <div className="rounded-sm border border-[var(--gray-border)] bg-[var(--gray-soft)] px-3 py-2 text-xs">
            Forbundet workspace: <span className="font-semibold">{status.team_name ?? status.team_id}</span>
          </div>
        ) : null}

        {!status?.connected ? (
          <Button
            type="button"
            className="wire-btn wire-btn-primary"
            onClick={() => {
              window.location.href = "/api/integrations/slack/oauth/start";
            }}
            disabled={loading || busy}
          >
            Forbind med Slack
          </Button>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="wire-form-label" htmlFor="slack-default-channel">
                Standardkanal
              </label>
              <select
                id="slack-default-channel"
                className="wire-form-input h-9"
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                disabled={busy || channels.length === 0}
              >
                <option value="">Vælg kanal</option>
                {channels.map((channel) => (
                  <option key={channel.channel_id} value={channel.channel_id}>
                    {channelLabel(channel)}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-sm"
                  onClick={() => void loadChannels()}
                  disabled={busy}
                >
                  Hent kanaler
                </Button>
              </div>
            </div>

            <details className="rounded-sm border border-[var(--gray-border)] px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-star-navy">
                Avanceret
              </summary>
              <div className="mt-3">
                <label className="wire-form-label" htmlFor="slack-webhook">
                  Webhook-URL (valgfrit)
                </label>
                <input
                  id="slack-webhook"
                  type="url"
                  className="wire-form-input h-9"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
            </details>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-[var(--gray-border)]"
                checked={Boolean(status.enabled)}
                onChange={(e) =>
                  setStatus((prev) =>
                    prev ? { ...prev, enabled: e.target.checked } : prev,
                  )
                }
              />
              <span className="font-semibold text-star-navy">Aktivér integration</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="wire-btn wire-btn-primary"
                onClick={() => void saveSettings()}
                disabled={busy}
              >
                {busy ? "Gemmer..." : "Gem indstillinger"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-sm"
                onClick={() => void disconnect()}
                disabled={busy}
              >
                Frakobl Slack
              </Button>
            </div>
          </div>
        )}
      </div>

      {loading ? <p className="text-muted-foreground text-xs">Henter Slack-status...</p> : null}
      {notice ? (
        <p className="text-[11px] font-semibold text-[#1a7a44]" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
