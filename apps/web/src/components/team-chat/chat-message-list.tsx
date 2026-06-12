"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { Bot, Hash, MessageSquareText, Video } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";
import {
  dateKey,
  formatDateSeparator,
  formatMessageTime,
  senderInitials,
} from "@/lib/team-chat/message-format";
import type { TeamChatChannel, TeamChatMessage } from "@/types/team-chat";

type ChatMessageListProps = Readonly<{
  messages: TeamChatMessage[];
  activeChannel: TeamChatChannel | null;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  endRef: React.RefObject<HTMLDivElement | null>;
}>;

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉"] as const;

function ChatEmptyState({ channel }: { channel: TeamChatChannel | null }) {
  const isDm = channel?.channel_type === "dm";
  const isBot = channel?.channel_type === "bot";
  const channelName = channel
    ? isDm || isBot
      ? channel.name
      : `#${channel.slug}`
    : null;

  return (
    <div className="team-chat-empty">
      <div className="team-chat-empty-icon" aria-hidden>
        {isBot ? <Bot className="size-7" /> : <MessageSquareText className="size-7" />}
      </div>
      <h3 className="team-chat-empty-title">
        {channelName ? `Velkommen til ${channelName}` : "Vælg en kanal"}
      </h3>
      <p className="team-chat-empty-desc">
        {isBot
          ? "Stil spørgsmål til Help-a-bot — den kan hjælpe med sager, vidensartikler og interne rutiner."
          : isDm
            ? "Dette er starten af jeres direkte samtale. Sig hej og del opdateringer her."
            : channel?.description
              ? channel.description
              : "Dette er starten af kanalen. Del opdateringer, spørgsmål og reaktioner med teamet."}
      </p>
      {!isBot ? (
        <ul className="team-chat-empty-tips">
          <li>Brug @ for at nævne kolleger (kommer snart)</li>
          <li>Reager med emoji på beskeder — hold musen over en besked</li>
          <li>Tryk Enter for at sende · Shift+Enter for ny linje</li>
        </ul>
      ) : null}
    </div>
  );
}

function MessageAvatar({ message }: { message: TeamChatMessage }) {
  if (message.is_bot) {
    return (
      <div className="team-chat-avatar team-chat-avatar--bot" aria-hidden>
        <Bot className="size-4" />
      </div>
    );
  }

  return (
    <div className="team-chat-avatar" aria-hidden>
      {senderInitials(message.sender_display_name)}
    </div>
  );
}

export function ChatMessageList({
  messages,
  activeChannel,
  onToggleReaction,
  endRef,
}: ChatMessageListProps) {
  const grouped = useMemo(() => {
    const items: Array<
      | { type: "separator"; key: string; label: string }
      | { type: "message"; key: string; message: TeamChatMessage }
    > = [];
    let lastDay: string | null = null;

    for (const message of messages) {
      const day = dateKey(message.created_at);
      if (day !== lastDay) {
        items.push({
          type: "separator",
          key: `sep-${day}`,
          label: formatDateSeparator(message.created_at),
        });
        lastDay = day;
      }
      items.push({ type: "message", key: message.id, message });
    }

    return items;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="team-chat-messages team-chat-messages--empty">
        <ChatEmptyState channel={activeChannel} />
        <div ref={endRef} />
      </div>
    );
  }

  return (
    <div className="team-chat-messages">
      <div className="team-chat-messages-inner">
        {grouped.map((item) =>
          item.type === "separator" ? (
            <div key={item.key} className="team-chat-date-separator" role="separator">
              <span>{item.label}</span>
            </div>
          ) : (
            <article
              key={item.key}
              className={cn(
                "team-chat-msg group",
                item.message.is_own && "team-chat-msg--own",
                item.message.is_bot && "team-chat-msg--bot",
              )}
            >
              {!item.message.is_own ? <MessageAvatar message={item.message} /> : null}
              <div className="team-chat-msg-content">
                {!item.message.is_own ? (
                  <div className="team-chat-msg-meta">
                    <span className="team-chat-msg-author">{item.message.sender_display_name}</span>
                    <time className="team-chat-msg-time" dateTime={item.message.created_at}>
                      {formatMessageTime(item.message.created_at)}
                    </time>
                  </div>
                ) : (
                  <time
                    className="team-chat-msg-time team-chat-msg-time--own"
                    dateTime={item.message.created_at}
                  >
                    {formatMessageTime(item.message.created_at)}
                  </time>
                )}
                <div className="team-chat-msg-bubble">
                  <p className="team-chat-msg-body whitespace-pre-wrap">{item.message.body}</p>
                </div>
                {item.message.tool_call_meta?.tools_used ? (
                  <p className="team-chat-tool-badge">🔧 Tool calling aktiv</p>
                ) : null}
                {item.message.reactions.length > 0 ? (
                  <div className="team-chat-reactions">
                    {item.message.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        className={cn(
                          "team-chat-reaction",
                          r.reacted_by_me && "team-chat-reaction--mine",
                        )}
                        onClick={() => fireAndForget(onToggleReaction(item.message.id, r.emoji))}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="team-chat-quick-react" aria-label="Hurtige reaktioner">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="team-chat-quick-react-btn"
                      aria-label={`Reager med ${emoji}`}
                      onClick={() => fireAndForget(onToggleReaction(item.message.id, emoji))}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ),
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

export function ChatThreadHeader({
  channel,
  onStartHuddle,
}: {
  channel: TeamChatChannel | null;
  onStartHuddle?: () => void;
}) {
  if (!channel) {
    return (
      <div className="team-chat-thread-header">
        <Hash className="size-5 shrink-0 opacity-50" aria-hidden />
        <div className="min-w-0">
          <h2 className="team-chat-thread-title">STARchat</h2>
          <p className="team-chat-thread-subtitle">Intern team-chat</p>
        </div>
      </div>
    );
  }

  const isDm = channel.channel_type === "dm";
  const isBot = channel.channel_type === "bot";
  const title = isDm || isBot ? channel.name : `#${channel.slug}`;

  return (
    <div className="team-chat-thread-header">
      {isBot ? (
        <Bot className="size-5 shrink-0 text-star-blue" aria-hidden />
      ) : (
        <Hash className="size-5 shrink-0 text-star-blue" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="team-chat-thread-title">{title}</h2>
        <p className="team-chat-thread-subtitle">
          {channel.description ??
            (isBot
              ? "AI-assistent til intern support"
              : isDm
                ? "Direkte besked"
                : channel.is_private
                  ? "Privat kanal"
                  : "Offentlig kanal")}
        </p>
      </div>
      {onStartHuddle && !isDm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="team-chat-huddle-btn shrink-0"
          onClick={onStartHuddle}
        >
          <Video className="size-4" aria-hidden />
          Huddle
        </Button>
      ) : null}
    </div>
  );
}
