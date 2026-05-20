"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IntegrationStatusPill } from "@/components/integrations/integration-status-pill";
import { Button } from "@/components/ui/button";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatIntegrationError } from "@/lib/format-integration-error";
import { saveIntegrationPartial } from "@/lib/integrations-config";
import type { GmailStatus, GmailSyncResult, GmailTestResult } from "@/types/gmail";

function statusFromGmail(status: GmailStatus): "active" | "draft" | "inactive" {
  if (status.connected && status.enabled) {
    return "active";
  }
  if (status.connected) {
    return "draft";
  }
  return "inactive";
}

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function GmailIntegrationSettings() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const statusPill = useMemo(() => (status ? statusFromGmail(status) : "inactive"), [status]);
  const statusLabel = useMemo(() => {
    if (!status) return "Ikke forbundet";
    if (status.connected && status.enabled) return "Aktiv";
    if (status.connected) return "Forbundet";
    return "Ikke forbundet";
  }, [status]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<GmailStatus>("/api/v1/integrations/gmail/status");
      setStatus(next);
      saveIntegrationPartial("gmail", {
        connected_email: next.connected_email ?? "",
        enabled: next.connected && next.enabled,
      });
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke hente Gmail-status",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (searchParams.get("connected") === "1") {
      setNotice("Gmail er nu forbundet.");
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(`Gmail OAuth fejlede: ${oauthError}`);
    }
  }, [searchParams]);

  async function saveSettings() {
    if (!status) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await apiPatch<GmailStatus>("/api/v1/integrations/gmail/settings", {
        enabled: status.connected ? status.enabled : false,
      });
      setStatus(next);
      saveIntegrationPartial("gmail", {
        connected_email: next.connected_email ?? "",
        enabled: next.connected && next.enabled,
      });
      setNotice("Gmail-indstillinger gemt.");
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke gemme Gmail-indstillinger",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function runSync() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiPost<GmailSyncResult>("/api/v1/integrations/gmail/sync", {});
      await loadStatus();
      setNotice(
        `Sync fuldført: ${result.processed} behandlet, ${result.created_tickets} nye sager, ${result.appended_to_threads} på eksisterende tråde.`,
      );
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke synkronisere Gmail",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiGet<GmailTestResult>("/api/v1/integrations/gmail/test");
      setNotice(`${result.detail}${result.connected_email ? ` (${result.connected_email})` : ""}`);
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke teste Gmail-forbindelsen",
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
      const next = await apiPost<GmailStatus>("/api/v1/integrations/gmail/disconnect", {});
      setStatus(next);
      saveIntegrationPartial("gmail", { connected_email: "", enabled: false });
      setNotice("Gmail er frakoblet.");
    } catch (err) {
      setError(
        formatIntegrationError(
          err instanceof Error ? err.message : "Kunne ikke frakoble Gmail",
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
        <h2 className="wire-card-title">Gmail</h2>
        <p className="text-muted-foreground text-xs">
          Forbind STARdesk med Gmail via OAuth for at oprette sager fra indgående e-mails og svare i samme tråd.
        </p>
        <div className="rounded-sm border border-[var(--gray-border)] bg-[var(--gray-soft)] px-3 py-2 text-xs">
          Forbundet adresse: <span className="font-semibold">{status?.connected_email ?? "—"}</span>
        </div>
        <div className="rounded-sm border border-[var(--gray-border)] bg-[var(--gray-soft)] px-3 py-2 text-xs">
          Seneste sync: <span className="font-semibold">{formatDate(status?.last_sync_at ?? null)}</span>
        </div>

        {!status?.connected ? (
          <Button
            type="button"
            className="wire-btn wire-btn-primary"
            onClick={() => {
              window.location.href = "/api/integrations/gmail/oauth/start";
            }}
            disabled={loading || busy}
          >
            Forbind med Gmail
          </Button>
        ) : (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-[var(--gray-border)]"
                checked={Boolean(status.enabled)}
                onChange={(e) => setStatus((prev) => (prev ? { ...prev, enabled: e.target.checked } : prev))}
              />
              <span className="font-semibold text-star-navy">Aktivér integration</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" className="wire-btn wire-btn-primary" onClick={() => void saveSettings()} disabled={busy}>
                {busy ? "Gemmer..." : "Gem indstillinger"}
              </Button>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => void testConnection()} disabled={busy}>
                Test forbindelse
              </Button>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => void runSync()} disabled={busy}>
                Kør sync nu
              </Button>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => void disconnect()} disabled={busy}>
                Frakobl Gmail
              </Button>
            </div>
          </div>
        )}
      </div>

      {loading ? <p className="text-muted-foreground text-xs">Henter Gmail-status...</p> : null}
      {notice ? (
        <p className="text-[11px] font-semibold text-[#1a7a44]" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
