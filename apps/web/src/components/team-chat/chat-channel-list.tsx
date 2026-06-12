"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { Hash, Lock, MessageCircle, Plus, Bot, UserRound } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TeamChatChannel, TeamChatStaff } from "@/types/team-chat";

function channelIcon(ch: TeamChatChannel) {
  if (ch.channel_type === "bot") return Bot;
  if (ch.channel_type === "dm") return UserRound;
  if (ch.is_private) return Lock;
  return Hash;
}

function channelLabel(ch: TeamChatChannel): string {
  if (ch.channel_type === "dm") return ch.name;
  if (ch.channel_type === "bot") return ch.name;
  return ch.slug;
}

export function ChatChannelList({
  channels,
  activeChannelId,
  staff,
  onSelect,
  onChannelCreated,
  onDmCreated,
}: {
  channels: TeamChatChannel[];
  activeChannelId: string | null;
  staff: TeamChatStaff[];
  onSelect: (id: string) => void;
  onChannelCreated: (ch: TeamChatChannel) => void;
  onDmCreated: (ch: TeamChatChannel) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicChannels = channels.filter(
    (c) => c.channel_type === "public" || c.channel_type === "bot",
  );
  const dmChannels = channels.filter((c) => c.channel_type === "dm");
  const privateChannels = channels.filter((c) => c.channel_type === "private");

  const createChannel = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const ch = await apiPost<TeamChatChannel>("/api/v1/team-chat/channels", {
        name: trimmed,
        is_private: isPrivate,
      });
      onChannelCreated(ch);
      onSelect(ch.id);
      setCreateOpen(false);
      setName("");
      setIsPrivate(false);
    } catch {
      setError("Kunne ikke oprette kanal.");
    } finally {
      setBusy(false);
    }
  }, [name, isPrivate, onChannelCreated, onSelect]);

  const startDm = useCallback(
    async (userId: string) => {
      setBusy(true);
      setError(null);
      try {
        const ch = await apiPost<TeamChatChannel>("/api/v1/team-chat/dm", {
          user_id: userId,
        });
        onDmCreated(ch);
        onSelect(ch.id);
        setDmOpen(false);
      } catch {
        setError("Kunne ikke starte DM.");
      } finally {
        setBusy(false);
      }
    },
    [onDmCreated, onSelect],
  );

  const renderRow = (ch: TeamChatChannel) => {
    const Icon = channelIcon(ch);
    const active = activeChannelId === ch.id;
    return (
      <button
        key={ch.id}
        type="button"
        className={cn("team-chat-channel-row", active && "team-chat-channel-row--active")}
        onClick={() => onSelect(ch.id)}
      >
        <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{channelLabel(ch)}</span>
      </button>
    );
  };

  return (
    <div className="team-chat-channel-list">
      <div className="team-chat-channel-list-header">
        <span className="text-[10px] font-bold tracking-wide uppercase">Kanaler</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Opret kanal"
          onClick={() => {
            setCreateOpen((o) => !o);
            setDmOpen(false);
          }}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {createOpen ? (
        <div className="team-chat-channel-create px-2 pb-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kanalnavn"
            className="h-7 text-xs"
            disabled={busy}
          />
          <label className="mt-1 flex items-center gap-1.5 text-[10px]">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              disabled={busy}
            />
            Privat kanal
          </label>
          <Button
            type="button"
            size="sm"
            className="mt-1 h-7 w-full text-[10px]"
            disabled={busy || !name.trim()}
            onClick={() => fireAndForget(createChannel())}
          >
            Opret
          </Button>
        </div>
      ) : null}

      <div className="team-chat-channel-section">{publicChannels.map(renderRow)}</div>

      {privateChannels.length > 0 ? (
        <>
          <p className="team-chat-channel-section-label">Private</p>
          <div className="team-chat-channel-section">{privateChannels.map(renderRow)}</div>
        </>
      ) : null}

      <div className="team-chat-channel-list-header mt-2">
        <span className="text-[10px] font-bold tracking-wide uppercase">Direkte</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Ny besked"
          onClick={() => {
            setDmOpen((o) => !o);
            setCreateOpen(false);
          }}
        >
          <MessageCircle className="size-3.5" />
        </Button>
      </div>

      {dmOpen ? (
        <ul className="max-h-32 overflow-y-auto px-1 pb-1">
          {staff.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="team-chat-dm-pick w-full px-2 py-1 text-left text-[11px]"
                disabled={busy}
                onClick={() => fireAndForget(startDm(s.id))}
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="team-chat-channel-section">{dmChannels.map(renderRow)}</div>

      {error ? (
        <p className="text-destructive px-2 text-[10px]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
