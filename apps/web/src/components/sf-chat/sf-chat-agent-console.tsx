"use client";

import { MessageCircle, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiGet, apiPost, apiPostNoContent, apiPut } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  SfChatAgentInbox,
  SfChatAgentInboxItem,
  SfChatMessage,
  SfChatPresence,
  SfChatSession,
  SfChatStatus,
} from "@/types/sf-chat";
import type { Ticket } from "@/types/ticket";

const POLL_MS = 4000;
const HEARTBEAT_MS = 25000;

type PollResponse = {
  session: SfChatSession | null;
  messages: SfChatMessage[];
  status: SfChatStatus;
};

export function SfChatAgentConsole() {
  const router = useRouter();
  const [presence, setPresence] = useState<SfChatPresence | null>(null);
  const [inbox, setInbox] = useState<SfChatAgentInbox | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadCustomerName, setThreadCustomerName] = useState<string>("");
  const [threadSession, setThreadSession] = useState<SfChatSession | null>(null);
  const [messages, setMessages] = useState<SfChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingPresence, setLoadingPresence] = useState(false);
  const [transferPrompt, setTransferPrompt] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());

  const loadPresence = useCallback(async () => {
    try {
      const p = await apiGet<SfChatPresence>("/api/v1/sf-chat/presence");
      setPresence(p);
    } catch {
      setPresence(null);
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const data = await apiGet<SfChatAgentInbox>("/api/v1/sf-chat/agent/inbox");
      setInbox(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  const pollThread = useCallback(async (sessionId: string) => {
    try {
      const data = await apiGet<PollResponse>(`/api/v1/sf-chat/sessions/${sessionId}/poll`);
      setMessages(data.messages);
      setThreadSession(data.session);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadPresence();
  }, [loadPresence]);

  useEffect(() => {
    if (!presence?.is_sf_member) return;
    const id = window.setInterval(() => {
      void loadInbox();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [presence?.is_sf_member, loadInbox]);

  useEffect(() => {
    if (!presence?.is_online) return;
    void apiPostNoContent("/api/v1/sf-chat/presence/heartbeat", {}).catch(() => undefined);
    const id = window.setInterval(() => {
      void apiPostNoContent("/api/v1/sf-chat/presence/heartbeat", {}).catch(() => undefined);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [presence?.is_online]);

  useEffect(() => {
    if (!threadId) return;
    void pollThread(threadId);
    const id = window.setInterval(() => void pollThread(threadId), POLL_MS);
    return () => window.clearInterval(id);
  }, [threadId, pollThread]);

  useEffect(() => {
    if (!inbox || !presence?.is_online) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
    for (const item of inbox.items) {
      if (item.unread_count <= 0) continue;
      const key = `${item.session.id}-${item.last_message_at ?? ""}`;
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      if (Notification.permission === "granted") {
        new Notification("Ny SF-chat", {
          body: `${item.customer_display_name}: ${item.last_message_preview ?? "Ny besked"}`,
          tag: item.session.id,
        });
      }
    }
  }, [inbox, presence?.is_online]);

  const selectThread = (item: SfChatAgentInboxItem) => {
    setThreadId(item.session.id);
    setThreadCustomerName(item.customer_display_name);
    setThreadSession(item.session);
    setTransferPrompt(false);
    void pollThread(item.session.id);
  };

  const toggleOnline = async () => {
    if (!presence?.is_sf_member) return;
    setLoadingPresence(true);
    try {
      const next = !presence.is_online;
      const updated = await apiPut<SfChatPresence>("/api/v1/sf-chat/presence", {
        online: next,
        force: false,
      });
      setPresence(updated);
      if (next) {
        void loadInbox();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const stay = window.confirm(
          `${e.message}\n\nVil du blive logget på chat?`,
        );
        if (!stay) {
          const forced = await apiPut<SfChatPresence>("/api/v1/sf-chat/presence", {
            online: false,
            force: true,
          });
          setPresence(forced);
        }
      }
    } finally {
      setLoadingPresence(false);
    }
  };

  const sendReply = async () => {
    const text = draft.trim();
    const sid = threadId;
    if (!text || !sid) return;
    setDraft("");
    try {
      const msg = await apiPost<SfChatMessage>(`/api/v1/sf-chat/sessions/${sid}/messages`, {
        body: text,
      });
      setMessages((prev) => [...prev, msg]);
      void loadInbox();
    } catch {
      // ignore
    }
  };

  const createTicketFromThread = async () => {
    if (!threadId) return;
    setTransferBusy(true);
    try {
      const ticket = await apiPost<Ticket>(`/api/v1/sf-chat/sessions/${threadId}/create-ticket`, {});
      setTransferPrompt(false);
      router.push(`/tickets/${ticket.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        window.alert(e.message);
      }
    } finally {
      setTransferBusy(false);
    }
  };

  if (!presence?.is_sf_member) {
    return null;
  }

  const badge = inbox?.notification_count ?? 0;
  const threadClosed = threadSession?.status === "closed";
  const showTransferStrip =
    Boolean(threadId && threadClosed && messages.length > 0 && !transferPrompt);

  return (
    <>
      <button
        type="button"
        className={cn("sf-chat-agent-fab", presence.is_online && "sf-chat-agent-fab--on")}
        onClick={() => setPanelOpen((o) => !o)}
        aria-label="SF chat konsol"
      >
        <MessageCircle className="size-5" />
        {badge > 0 ? <span className="sf-chat-agent-badge">{badge}</span> : null}
      </button>

      {panelOpen ? (
        <div className="sf-chat-agent-panel" role="dialog" aria-label="SF agent chat">
          <header className="sf-chat-agent-panel-header">
            <div>
              <h2 className="text-sm font-bold text-star-navy">SF live chat</h2>
              <p className="text-[10px] text-[var(--gray-mid)]">
                {presence.is_online ? "Du er logget på" : "Du er offline"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={presence.is_online ? "outline" : "default"}
              disabled={loadingPresence}
              onClick={() => void toggleOnline()}
            >
              {presence.is_online ? "Gå offline" : "Log på chat"}
            </Button>
          </header>

          <div className="sf-chat-agent-panel-body">
            <ul className="sf-chat-agent-inbox">
              {(inbox?.items ?? []).length === 0 ? (
                <li className="text-muted-foreground px-2 py-3 text-xs">
                  Ingen ventende chats.
                </li>
              ) : (
                inbox?.items.map((item) => (
                  <li key={item.session.id}>
                    <button
                      type="button"
                      className={cn(
                        "sf-chat-agent-inbox-item",
                        threadId === item.session.id && "sf-chat-agent-inbox-item--active",
                      )}
                      onClick={() => selectThread(item)}
                    >
                      <span className="font-medium">{item.customer_display_name}</span>
                      {item.customer_is_typing ? (
                        <span className="text-star-blue text-[10px]">skriver…</span>
                      ) : null}
                      {item.unread_count > 0 ? (
                        <span className="sf-chat-agent-inbox-dot" aria-label="Ulæst" />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>

            {threadId ? (
              <div className="sf-chat-agent-thread">
                <p className="text-[11px] font-medium text-star-navy">
                  {threadCustomerName}
                </p>
                {threadClosed ? (
                  <p className="text-muted-foreground mb-1 text-[10px]">
                    Chatten er afsluttet.
                  </p>
                ) : null}

                {transferPrompt ? (
                  <div
                    className="border-star-navy/20 bg-star-navy/5 mb-2 rounded-[2px] border px-2 py-2 text-[10px] text-star-navy"
                    role="dialog"
                    aria-label="Overfør til sag"
                  >
                    <p className="mb-2 font-medium">Skal chatten overføres til en sag?</p>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-[10px]"
                        disabled={transferBusy}
                        onClick={() => void createTicketFromThread()}
                      >
                        Ja
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        disabled={transferBusy}
                        onClick={() => setTransferPrompt(false)}
                      >
                        Nej
                      </Button>
                    </div>
                  </div>
                ) : null}

                {showTransferStrip ? (
                  <div className="mb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[10px]"
                      onClick={() => setTransferPrompt(true)}
                    >
                      Overfør til sag…
                    </Button>
                  </div>
                ) : null}

                <div className="sf-chat-messages sf-chat-messages--compact">
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
                      {m.is_system ? (
                        <>
                          <span className="sf-chat-bubble-name">System</span>
                          <p>{m.body}</p>
                        </>
                      ) : (
                        <>
                          {!m.is_own ? (
                            <span className="sf-chat-bubble-name">{m.sender_display_name}</span>
                          ) : null}
                          <p>{m.body}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="sf-chat-panel-footer mt-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Svar kunden…"
                    rows={2}
                    className="min-h-[2rem] resize-none text-xs"
                    disabled={!presence.is_online || threadClosed}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="sf-chat-send shrink-0"
                    disabled={!presence.is_online || threadClosed || !draft.trim()}
                    onClick={() => void sendReply()}
                    aria-label="Send svar"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
                Vælg en chat i listen
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
