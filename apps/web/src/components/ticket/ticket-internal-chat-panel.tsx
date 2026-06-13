"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AtSign, MessageCircle, Send, UserPlus } from "lucide-react";

import { MentionTextarea } from "@/components/ticket/mention-textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import {
  buildAssignablePeople,
  filterPeopleForSearch,
  type SearchableOption,
} from "@/lib/assignment-search";
import {
  dispatchMentionsOverviewChanged,
  type TicketInternalChat,
} from "@/types/ticket-internal-chat";
import type { Team } from "@/types/team";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketInternalChatPanel({
  ticketId,
  ticketNumber,
  teams,
}: Readonly<{
  ticketId: string;
  ticketNumber: string;
  teams: Team[];
}>) {
  const [chat, setChat] = useState<TicketInternalChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [inviteQuery, setInviteQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = buildAssignablePeople(teams);
  const inviteOptions = filterPeopleForSearch(people, inviteQuery);

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<TicketInternalChat>(`/api/v1/tickets/${ticketId}/internal-chat`);
      setChat(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente intern chat");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fireAndForget(reload());
  }, [reload]);

  async function invitePerson(option: SearchableOption) {
    if (!option.id) return;
    setSending(true);
    setError(null);
    try {
      const data = await apiPost<TicketInternalChat>(
        `/api/v1/tickets/${ticketId}/internal-chat/invite`,
        { user_id: option.id },
      );
      setChat(data);
      setInviteQuery("");
      dispatchMentionsOverviewChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke indkalde person");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await apiPost<TicketInternalChat>(
        `/api/v1/tickets/${ticketId}/internal-chat/messages`,
        { body: trimmed },
      );
      setChat(data);
      setDraft("");
      dispatchMentionsOverviewChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke sende besked");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="portal-v2-card space-y-3 p-4" aria-label="Intern sagssamtale">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="portal-v2-section-title flex items-center gap-2">
            <MessageCircle className="size-4" aria-hidden />
            Intern chat
          </h2>
          <p className="text-muted-foreground text-xs">
            Kun synlig for kolleger — knyttet til {ticketNumber}
          </p>
        </div>
        <Link
          href={`/chat${chat?.channel_id ? `?channel=${chat.channel_id}` : ""}`}
          className="text-star-blue text-xs font-semibold hover:underline"
        >
          Åbn i teamchat
        </Link>
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
          <UserPlus className="size-3.5" aria-hidden />
          Indkald kollega (tilføjes som interessent)
        </p>
        <SearchableSelect
          valueId={null}
          query={inviteQuery}
          onQueryChange={setInviteQuery}
          options={inviteOptions}
          placeholder="Søg kollega…"
          disabled={sending}
          onSelect={(option) => fireAndForget(invitePerson(option))}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Henter samtale…</p>
      ) : (
        <div className="border-border max-h-56 space-y-2 overflow-y-auto rounded-md border bg-[var(--gray-bg)] p-2">
          {(chat?.messages.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-xs">
              Ingen beskeder endnu. Indkald en kollega eller skriv den første besked.
            </p>
          ) : (
            chat?.messages.map((msg) => (
              <article
                key={msg.id}
                className={`rounded-md px-2 py-1.5 text-sm ${msg.is_own ? "bg-star-blue/10 ml-4" : "bg-white mr-4"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-star-navy text-xs font-semibold">
                    {msg.sender_display_name}
                  </span>
                  <time className="text-muted-foreground text-[10px]" dateTime={msg.created_at}>
                    {formatTime(msg.created_at)}
                  </time>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{msg.body}</p>
              </article>
            ))
          )}
        </div>
      )}

      <div className="space-y-2">
        <MentionTextarea
          value={draft}
          onChange={setDraft}
          teams={teams}
          rows={2}
          placeholder="Skriv intern besked til sagsteamet…"
          disabled={sending}
        />
        <Button
          type="button"
          size="sm"
          className="bg-star-navy hover:bg-star-blue"
          disabled={sending || !draft.trim()}
          onClick={() => fireAndForget(sendMessage())}
        >
          <Send className="size-3.5" aria-hidden />
          Send i intern chat
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
        <AtSign className="size-3" aria-hidden />
        Brug @ i kommentarer for at nævne — personen tilføjes automatisk her og som interessent.
      </p>
    </section>
  );
}
