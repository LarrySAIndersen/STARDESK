"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiGet, apiPost, apiPostNoContent } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SfChatMessage, SfChatSession, SfChatStatus } from "@/types/sf-chat";

const POLL_MS = 3000;
const SF_CHAT_TICKET_PREFILL_KEY = "stardesk_sf_chat_ticket_description";

function buildLocalTranscript(messages: SfChatMessage[]): string {
  return messages
    .map((m) => {
      const d = new Date(m.created_at);
      const ts = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const who = m.is_system ? "System" : m.sender_display_name;
      return `[${ts}] ${who}: ${m.body}`;
    })
    .join("\n");
}

function proxyAbandonUrl(sessionId: string): string {
  const path = `/api/v1/sf-chat/sessions/${sessionId}/abandon`;
  if (path.startsWith("/api/v1/")) {
    return `/api/proxy/${path.slice("/api/".length)}`;
  }
  return path;
}

type SessionResponse = {
  session: SfChatSession;
  messages: SfChatMessage[];
};

type PollResponse = {
  session: SfChatSession | null;
  messages: SfChatMessage[];
  status: SfChatStatus;
};

export function SfChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SfChatStatus | null>(null);
  const [session, setSession] = useState<SfChatSession | null>(null);
  const [messages, setMessages] = useState<SfChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferDismissed, setTransferDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const sessionStatusRef = useRef<string | undefined>(undefined);

  sessionRef.current = session?.id ?? null;
  sessionStatusRef.current = session?.status;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open, scrollToBottom]);

  const applyPoll = useCallback((data: PollResponse) => {
    setStatus(data.status);
    if (data.session) {
      setSession(data.session);
      setMessages(data.messages);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiGet<SfChatStatus>("/api/v1/sf-chat/status");
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  const ensureSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiPost<SessionResponse>("/api/v1/sf-chat/sessions", {});
      setSession(data.session);
      setMessages(data.messages);
      if (data.session.queue_message) {
        setError(data.session.queue_message);
      }
      await loadStatus();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("Kunne ikke starte chat.");
      }
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  const poll = useCallback(async () => {
    const sid = sessionRef.current;
    if (!sid) {
      await loadStatus();
      return;
    }
    try {
      const data = await apiGet<PollResponse>(`/api/v1/sf-chat/sessions/${sid}/poll`);
      applyPoll(data);
      if (data.session?.queue_message) {
        setError(data.session.queue_message);
      }
    } catch {
      // ignore transient poll errors
    }
  }, [applyPoll, loadStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const onPageHide = () => {
      const sid = sessionRef.current;
      const st = sessionStatusRef.current;
      if (!sid || (st !== "waiting" && st !== "active")) return;
      void fetch(proxyAbandonUrl(sid), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: "{}",
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!session && status?.open) {
      void ensureSession();
    }
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(id);
  }, [open, session, status?.open, ensureSession, poll]);

  const handleOpen = () => {
    setOpen(true);
    if (!session) {
      void ensureSession();
    }
  };

  const handleClose = () => {
    const sid = sessionRef.current;
    const st = sessionStatusRef.current;
    if (sid && (st === "waiting" || st === "active")) {
      void apiPost(`/api/v1/sf-chat/sessions/${sid}/abandon`, {}).catch(() => undefined);
    }
    setOpen(false);
  };

  const startNewChat = () => {
    setSession(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setTransferDismissed(false);
    void ensureSession();
  };

  const goCreateTicketFromChat = () => {
    const text = buildLocalTranscript(messages);
    if (text.trim()) {
      try {
        sessionStorage.setItem(SF_CHAT_TICKET_PREFILL_KEY, text);
      } catch {
        // ignore quota / private mode
      }
    }
    setTransferDismissed(true);
    router.push("/tickets/new?from_sf_chat=1");
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    const sid = sessionRef.current;
    if (sid && value.trim()) {
      void apiPostNoContent(`/api/v1/sf-chat/sessions/${sid}/typing`, {}).catch(() => undefined);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    const sid = session?.id;
    if (!text || !sid) return;
    setDraft("");
    setError(null);
    try {
      const msg = await apiPost<SfChatMessage>(
        `/api/v1/sf-chat/sessions/${sid}/messages`,
        { body: text },
      );
      setMessages((prev) => [...prev, msg]);
      void poll();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      }
    }
  };

  const chatClosed = status && !status.open;
  const queueRejected = session?.status === "rejected_queue";
  const sessionClosed = session?.status === "closed";
  const canSend =
    Boolean(session?.id) &&
    !chatClosed &&
    !queueRejected &&
    session?.status !== "closed";
  const showTransferPrompt =
    Boolean(sessionClosed && messages.length > 0 && !queueRejected && !transferDismissed);

  return (
    <>
      {!open ? (
        <button
          type="button"
          className="sf-chat-fab"
          onClick={handleOpen}
          aria-label="Åbn chat med SF"
        >
          <MessageCircle className="size-6" aria-hidden />
          <span className="sf-chat-fab-label">Chat med SF</span>
        </button>
      ) : null}

      {open ? (
        <div className="sf-chat-panel" role="dialog" aria-label="SF live chat">
          <header className="sf-chat-panel-header">
            <h2 className="sf-chat-panel-title">Hurtig chat — SF</h2>
            <p className="sf-chat-panel-sub">
              {status?.open
                ? `${status.available_agents} agent${status.available_agents === 1 ? "" : "er"} tilgængelig`
                : "Ingen agenter logget på"}
            </p>
            <button
              type="button"
              className="sf-chat-panel-close"
              onClick={handleClose}
              aria-label="Luk chat"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="sf-chat-panel-body">
            {loading && messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">Forbinder til SF…</p>
            ) : null}

            {chatClosed && !session?.assigned_agent_id ? (
              <div className="sf-chat-banner sf-chat-banner--closed">
                Chatten er ikke åben lige nu. Prøv igen senere.
              </div>
            ) : null}

            {queueRejected || session?.queue_message ? (
              <div className="sf-chat-banner sf-chat-banner--queue">
                {session?.queue_message ??
                  "Der er meget lange køer lige nu, så chatten er utilgængelig. Prøv venligst igen senere."}
              </div>
            ) : null}

            {sessionClosed && !queueRejected ? (
              <div className="sf-chat-banner sf-chat-banner--closed">
                Chatten er afsluttet. Du kan starte en ny chat når som helst.
              </div>
            ) : null}

            {showTransferPrompt ? (
              <div
                className="border-star-navy/20 bg-star-navy/5 rounded-[2px] border px-3 py-2 text-[12px] text-star-navy"
                role="dialog"
                aria-label="Overfør chat til sag"
              >
                <p className="mb-2 font-medium">Skal chatten overføres til en sag?</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="default" onClick={() => goCreateTicketFromChat()}>
                    Ja
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setTransferDismissed(true)}
                  >
                    Nej
                  </Button>
                </div>
              </div>
            ) : null}

            {sessionClosed ? (
              <div className="mb-1">
                <Button type="button" size="sm" variant="outline" onClick={() => startNewChat()}>
                  Ny chat
                </Button>
              </div>
            ) : null}

            {error && !queueRejected ? (
              <p className="text-star-red text-sm" role="alert">
                {error}
              </p>
            ) : null}

            <div className="sf-chat-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "sf-chat-bubble",
                    m.is_system
                      ? "sf-chat-bubble--system"
                      : m.is_own
                        ? "sf-chat-bubble--own"
                        : "sf-chat-bubble--agent",
                  )}
                >
                  {!m.is_own && !m.is_system ? (
                    <span className="sf-chat-bubble-name">{m.sender_display_name}</span>
                  ) : null}
                  {m.is_system ? (
                    <span className="sf-chat-bubble-name">System</span>
                  ) : null}
                  <p>{m.body}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="sf-chat-panel-footer">
            <Textarea
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              placeholder={
                canSend ? "Skriv din besked…" : "Chat er ikke tilgængelig"
              }
              disabled={!canSend}
              rows={2}
              className="min-h-[2.5rem] resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="sf-chat-send shrink-0"
              disabled={!canSend || !draft.trim()}
              onClick={() => void sendMessage()}
              aria-label="Send besked"
            >
              <Send className="size-4" />
            </Button>
          </footer>
        </div>
      ) : null}
    </>
  );
}
