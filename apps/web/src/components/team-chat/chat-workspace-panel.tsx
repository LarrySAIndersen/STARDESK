"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { Maximize2, Send, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatChannelList } from "@/components/team-chat/chat-channel-list";
import { ChatEmojiPicker } from "@/components/team-chat/chat-emoji-picker";
import { ChatHuddleMock } from "@/components/team-chat/chat-huddle-mock";
import { useChatWorkspace } from "@/components/team-chat/chat-workspace-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TeamChatChannel, TeamChatMessage, TeamChatStaff } from "@/types/team-chat";

const POLL_MS = 4000;

type MessagesResponse = Readonly<{ messages: TeamChatMessage[] }>;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function mergeMessages(prev: TeamChatMessage[], incoming: TeamChatMessage[]): TeamChatMessage[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) {
    map.set(m.id, m);
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

type ChatWorkspacePanelProps = Readonly<{
  layout?: "panel" | "page" | "dock";
}>;

export function ChatWorkspacePanel({ layout = "panel" }: ChatWorkspacePanelProps) {
  const router = useRouter();
  const { closeChat, activeChannelId, setActiveChannelId } = useChatWorkspace();
  const isPage = layout === "page";
  const isDock = layout === "dock";
  const [channels, setChannels] = useState<TeamChatChannel[]>([]);
  const [staff, setStaff] = useState<TeamChatStaff[]>([]);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [huddleOpen, setHuddleOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastPollRef = useRef<string | null>(null);

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  const loadChannels = useCallback(async () => {
    try {
      const data = await apiGet<TeamChatChannel[]>("/api/v1/team-chat/channels");
      setChannels(data);
      if (!activeChannelId && data.length > 0) {
        const general = data.find((c) => c.slug === "general") ?? data[0];
        setActiveChannelId(general.id);
      }
    } catch {
      setError("Kunne ikke hente kanaler.");
    }
  }, [activeChannelId, setActiveChannelId]);

  const loadStaff = useCallback(async () => {
    try {
      const data = await apiGet<TeamChatStaff[]>("/api/v1/team-chat/staff");
      setStaff(data);
    } catch {
      setStaff([]);
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string, after?: string | null) => {
    const qs = after ? `?after=${encodeURIComponent(after)}` : "";
    const data = await apiGet<MessagesResponse>(
      `/api/v1/team-chat/channels/${channelId}/messages${qs}`,
    );
    if (after) {
      setMessages((prev) => mergeMessages(prev, data.messages));
    } else {
      setMessages(data.messages);
    }
    if (data.messages.length > 0) {
      lastPollRef.current = data.messages[data.messages.length - 1].created_at;
    }
  }, []);

  useEffect(() => {
    fireAndForget(
      (async () => {
        setLoading(true);
        await Promise.all([loadChannels(), loadStaff()]);
        setLoading(false);
      })(),
    );
  }, [loadChannels, loadStaff]);

  useEffect(() => {
    if (!activeChannelId) return;
    lastPollRef.current = null;
    setMessages([]);
    fireAndForget(
      loadMessages(activeChannelId).catch(() => setError("Kunne ikke hente beskeder.")),
    );
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeChannelId) return;
    const id = window.setInterval(() => {
      const after = lastPollRef.current;
      fireAndForget(
        apiGet<MessagesResponse>(
          `/api/v1/team-chat/channels/${activeChannelId}/poll${after ? `?after=${encodeURIComponent(after)}` : ""}`,
        )
          .then((data) => {
            if (data.messages.length > 0) {
              setMessages((prev) => mergeMessages(prev, data.messages));
              lastPollRef.current = data.messages[data.messages.length - 1].created_at;
            }
          })
          .catch(() => undefined),
      );
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [activeChannelId]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activeChannelId || sending) return;
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const data = await apiPost<MessagesResponse>(
        `/api/v1/team-chat/channels/${activeChannelId}/messages`,
        { body: text },
      );
      setMessages((prev) => mergeMessages(prev, data.messages));
      if (data.messages.length > 0) {
        lastPollRef.current = data.messages[data.messages.length - 1].created_at;
      }
    } catch {
      setError("Kunne ikke sende besked.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [draft, activeChannelId, sending]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const reactions = await apiPost<TeamChatMessage["reactions"]>(
        `/api/v1/team-chat/messages/${messageId}/reactions`,
        { emoji },
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
      );
    } catch {
      // ignore
    }
  }, []);

  const insertEmoji = useCallback((emoji: string) => {
    setDraft((d) => `${d}${emoji}`);
  }, []);

  const channelTitle = activeChannel
    ? activeChannel.channel_type === "dm"
      ? activeChannel.name
      : `#${activeChannel.slug}`
    : "Chat";

  const openFullPage = useCallback(() => {
    closeChat();
    router.push("/chat");
  }, [closeChat, router]);

  return (
    <div
      className={cn(
        "team-chat-workspace flex h-full min-h-0 flex-col",
        isPage && "team-chat-workspace--page",
        isDock && "team-chat-workspace--dock",
      )}
    >
      <header className="team-chat-workspace-header">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-star-navy">{channelTitle}</h2>
          <p className="text-muted-foreground text-[10px]">
            {isPage
              ? "Intern team-chat"
              : isDock
                ? "Ctrl+Shift+C · Magnetisk dock"
                : "Ctrl+Shift+C · Intern chat"}
          </p>
        </div>
        {activeChannel && activeChannel.channel_type !== "dm" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Start huddle"
            title="Start huddle (mock)"
            onClick={() => setHuddleOpen(true)}
          >
            <Video className="size-4" />
          </Button>
        ) : null}
        {!isPage ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="Åbn chat i fuld side"
              title="Åbn chat i fuld side"
              onClick={openFullPage}
            >
              <Maximize2 className="size-4" />
            </Button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
              onClick={closeChat}
              aria-label="Luk chat"
            >
              <X className="size-4" />
            </button>
          </>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <ChatChannelList
          channels={channels}
          activeChannelId={activeChannelId}
          staff={staff}
          onSelect={setActiveChannelId}
          onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
          onDmCreated={(ch) =>
            setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [...prev, ch]))
          }
        />

        <div className="team-chat-thread flex min-w-0 flex-1 flex-col">
          {loading ? (
            <p className="text-muted-foreground p-3 text-xs">Indlæser chat…</p>
          ) : null}

          {error ? (
            <p className="text-destructive px-3 py-1 text-xs" role="alert">
              {error}
            </p>
          ) : null}

          <div className="team-chat-messages flex-1 overflow-y-auto px-3 py-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "team-chat-msg group",
                  m.is_own && "team-chat-msg--own",
                  m.is_bot && "team-chat-msg--bot",
                )}
              >
                <div className="team-chat-msg-meta">
                  <span className="font-semibold">{m.sender_display_name}</span>
                  <span className="text-muted-foreground">{formatTime(m.created_at)}</span>
                </div>
                <p className="team-chat-msg-body whitespace-pre-wrap">{m.body}</p>
                {m.tool_call_meta?.tools_used ? (
                  <p className="team-chat-tool-badge text-[10px]">🔧 Tool calling aktiv</p>
                ) : null}
                {m.reactions.length > 0 ? (
                  <div className="team-chat-reactions">
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        className={cn(
                          "team-chat-reaction",
                          r.reacted_by_me && "team-chat-reaction--mine",
                        )}
                        onClick={() => fireAndForget(toggleReaction(m.id, r.emoji))}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="team-chat-quick-react">
                  {["👍", "❤️", "😂", "🎉"].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="team-chat-quick-react-btn"
                      aria-label={`Reager med ${emoji}`}
                      onClick={() => fireAndForget(toggleReaction(m.id, emoji))}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <footer className="team-chat-composer">
            <ChatEmojiPicker onPick={insertEmoji} />
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                activeChannel?.channel_type === "bot"
                  ? "Spørg Help-a-bot…"
                  : "Skriv en besked…"
              }
              rows={2}
              disabled={!activeChannelId || sending}
              className="min-h-[2.5rem] flex-1 resize-none text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  fireAndForget(sendMessage());
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0"
              disabled={!activeChannelId || sending || !draft.trim()}
              onClick={() => fireAndForget(sendMessage())}
              aria-label="Send besked"
            >
              <Send className="size-4" />
            </Button>
          </footer>
        </div>
      </div>

      <ChatHuddleMock
        open={huddleOpen}
        onClose={() => setHuddleOpen(false)}
        channelName={activeChannel?.slug ?? "kanal"}
      />
    </div>
  );
}
