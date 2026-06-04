"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiGet, apiPost } from "@/lib/api";
import type { SlackChannel, SlackPushResponse, SlackStatus } from "@/types/slack";

function channelLabel(channel: SlackChannel): string {
  const prefix = channel.is_private ? "🔒" : "#";
  return `${prefix}${channel.name} — ${channel.display_name_da}`;
}

export function TicketSlackPush({
  ticketId,
  ticketNumber,
  ticketTitle,
}: {
  ticketId: string;
  ticketNumber: string;
  ticketTitle: string;
}) {
  const router = useRouter();
  const titleId = useId();

  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMockMode, setIsMockMode] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setError(null);
  }, []);

  const panelRef = useFocusTrap(modalOpen, closeModal);

  const loadStatus = useCallback(async () => {
    try {
      const status = await apiGet<SlackStatus>("/api/v1/integrations/slack/status");
      setIsConnected(status.connected);
      setIsMockMode(status.mode === "mock");
      if (status.default_channel_id) {
        setChannelId(status.default_channel_id);
      }
    } catch {
      setIsConnected(false);
      setIsMockMode(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    setIsLoadingChannels(true);
    try {
      const list = await apiGet<SlackChannel[]>("/api/v1/integrations/slack/channels");
      setChannels(list);
      if (list.length > 0) {
        setChannelId((current) => {
          if (list.some((c) => c.channel_id === current)) {
            return current;
          }
          return list[0]!.channel_id;
        });
      }
    } catch (err) {
      setChannels([]);
      setError(err instanceof Error ? err.message : "Kunne ikke hente Slack-kanaler");
    } finally {
      setIsLoadingChannels(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(loadStatus());
  }, [loadStatus]);

  useEffect(() => {
    if (!isConnected && !isMockMode) {
      setChannels([]);
      return;
    }
    fireAndForget(loadChannels());
  }, [isConnected, isMockMode, loadChannels]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const openModal = () => {
    setError(null);
    if (!isConnected && !isMockMode) {
      setError("Slack er ikke forbundet. Gå til Integrationer > Slack for at forbinde.");
    }
    setModalOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    closeModal();
  };

  async function confirmPush() {
    if (!isConnected && !isMockMode) {
      setError("Slack er ikke forbundet.");
      return;
    }
    if (!channelId) {
      setError("Vælg en Slack-kanal.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<SlackPushResponse>(
        `/api/v1/tickets/${ticketId}/slack-push`,
        { channel_id: channelId },
      );
      const channel = channels.find((c) => c.channel_id === result.channel_id);
      const label = channel ? `#${channel.name}` : `#${result.channel_name}`;
      setSuccess(`Sag ${ticketNumber} er sendt til Slack (${label}).`);
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke sende til Slack");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {success ? (
        <p
          className="rounded-[2px] border border-[#6b9f7a] border-l-4 border-l-[#1A7A44] bg-[#E6F5EC] px-3 py-2 text-xs font-medium text-[#1A4D2E]"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="border-star-navy/30 text-star-navy hover:bg-star-blue-light rounded-sm"
        onClick={openModal}
      >
        Push sag til Slack
      </Button>

      {modalOpen ? (
        <div
          className="wire-confirm-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="wire-confirm-modal max-w-md"
          >
            <div className="border-b border-[var(--gray-border)] px-4 py-3.5">
              <h2 id={titleId} className="text-star-navy text-sm font-bold">
                Push sag til Slack
              </h2>
              <p className="text-[var(--gray-mid)] mt-1 text-[11px]">
                {ticketNumber} — {ticketTitle}
              </p>
              <p className="text-[var(--gray-mid)] mt-2 text-[10px]">
                {isConnected
                  ? "Beskeden sendes med workspace OAuth-bot."
                  : isMockMode
                    ? "Udviklingstilstand: mock Slack-kanaler (SLACK_MOCK=1)."
                    : "Slack er ikke forbundet endnu."}
              </p>
            </div>

            <div className="space-y-3 px-4 py-3.5">
              <div className="space-y-2">
                <Label htmlFor="slack-channel">Slack-kanal</Label>
                <select
                  id="slack-channel"
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  disabled={isSubmitting || isLoadingChannels || channels.length === 0}
                >
                  <option value="">
                    {isLoadingChannels ? "Henter kanaler..." : "Vælg kanal"}
                  </option>
                  {channels.map((channel) => (
                    <option key={channel.channel_id} value={channel.channel_id}>
                      {channelLabel(channel)}
                    </option>
                  ))}
                </select>
              </div>

              {error ? (
                <p className="text-star-red text-xs" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-[var(--gray-border)] pt-3">
                <button type="button" className="wire-btn" disabled={isSubmitting} onClick={handleClose}>
                  Annuller
                </button>
                <Button
                  type="button"
                  className="wire-btn wire-btn-primary"
                  disabled={isSubmitting || (!isConnected && !isMockMode)}
                  onClick={() => fireAndForget(confirmPush())}
                >
                  {isSubmitting ? "Sender…" : "Bekræft push"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
