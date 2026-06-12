"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { Maximize2, Send, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatChannelList } from "@/components/team-chat/chat-channel-list";
import { ChatEmojiPicker } from "@/components/team-chat/chat-emoji-picker";
import { ChatHuddleMock } from "@/components/team-chat/chat-huddle-mock";
import { ChatMessageList, ChatThreadHeader } from "@/components/team-chat/chat-message-list";
import { useChatWorkspace } from "@/components/team-chat/chat-workspace-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import { pickDefaultTeamChatChannel } from "@/lib/team-chat/channel-utils";
import { mergeTeamChatMessages } from "@/lib/team-chat/message-merge";
import { cn } from "@/lib/utils";
import type { TeamChatChannel, TeamChatMessage, TeamChatStaff } from "@/types/team-chat";

const POLL_MS = 4000;

type MessagesResponse = Readonly<{ messages: TeamChatMessage[] }>;

type ChatWorkspacePanelProps = Readonly<{
  layout?: "page" | "dock";
}>;

export function ChatWorkspacePanel({ layout = "page" }: ChatWorkspacePanelProps) {
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
        const defaultChannel = pickDefaultTeamChatChannel(data);
        if (defaultChannel) {
          setActiveChannelId(defaultChannel.id);
        }
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
      setMessages((prev) => mergeTeamChatMessages(prev, data.messages));
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
              setMessages((prev) => mergeTeamChatMessages(prev, data.messages));
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
      setMessages((prev) => mergeTeamChatMessages(prev, data.messages));
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

  const openFullPage = useCallback(() => {
    closeChat();
    router.push("/chat");
  }, [closeChat, router]);

  return (
    <div
      className={cn(
        "team-chat-workspace flex min-h-0 flex-col",
        isPage && "team-chat-workspace--page flex-1",
        isDock && "team-chat-workspace--dock h-full",
      )}
    >
      {isDock ? (
        <header className="team-chat-workspace-header team-chat-workspace-header--dock">
          <div className="min-w-0 flex-1">
            <p className="team-chat-dock-label">STARchat</p>
            <p className="text-muted-foreground text-xs">Ctrl+Shift+C · Magnetisk dock</p>
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
        </header>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <ChatChannelList
          channels={channels}
          activeChannelId={activeChannelId}
          staff={staff}
          layout={layout}
          onSelect={setActiveChannelId}
          onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
          onDmCreated={(ch) =>
            setChannels((prev) => (prev.some((c) => c.id === ch.id) ? prev : [...prev, ch]))
          }
        />

        <div className="team-chat-thread flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatThreadHeader
            channel={activeChannel}
            onStartHuddle={
              activeChannel && activeChannel.channel_type !== "dm"
                ? () => setHuddleOpen(true)
                : undefined
            }
          />

          {loading ? (
            <div className="team-chat-loading" aria-busy="true" aria-label="Indlæser chat">
              <div className="team-chat-loading-bar" />
              <p className="text-muted-foreground text-sm">Indlæser beskeder…</p>
            </div>
          ) : null}

          {error ? (
            <p className="team-chat-error" role="alert">
              {error}
            </p>
          ) : null}

          <ChatMessageList
            messages={messages}
            activeChannel={activeChannel}
            onToggleReaction={toggleReaction}
            endRef={endRef}
          />

          <footer className="team-chat-composer">
            <div className="team-chat-composer-box">
              <ChatEmojiPicker onPick={insertEmoji} />
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  activeChannel?.channel_type === "bot"
                    ? "Spørg Help-a-bot…"
                    : `Skriv en besked${activeChannel ? ` i ${activeChannel.channel_type === "dm" ? activeChannel.name : `#${activeChannel.slug}`}` : ""}…`
                }
                rows={2}
                disabled={!activeChannelId || sending}
                className="team-chat-composer-input min-h-[2.75rem] flex-1 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
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
                className="team-chat-send-btn shrink-0"
                disabled={!activeChannelId || sending || !draft.trim()}
                onClick={() => fireAndForget(sendMessage())}
                aria-label="Send besked"
              >
                <Send className="size-4" />
              </Button>
            </div>
            <p className="team-chat-composer-hint">
              <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> ny linje
            </p>
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
