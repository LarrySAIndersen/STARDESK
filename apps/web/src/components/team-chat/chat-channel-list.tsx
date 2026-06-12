"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { Hash, Lock, MessageCircle, MessagesSquare, Plus, Bot, UserRound, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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

function matchesQuery(ch: TeamChatChannel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    channelLabel(ch).toLowerCase().includes(q) ||
    (ch.description?.toLowerCase().includes(q) ?? false)
  );
}

export function ChatChannelList({
  channels,
  activeChannelId,
  staff,
  layout = "page",
  onSelect,
  onChannelCreated,
  onDmCreated,
}: {
  channels: TeamChatChannel[];
  activeChannelId: string | null;
  staff: TeamChatStaff[];
  layout?: "page" | "dock";
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
  const [search, setSearch] = useState("");

  const publicChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          (c.channel_type === "public" || c.channel_type === "bot") && matchesQuery(c, search),
      ),
    [channels, search],
  );
  const dmChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "dm" && matchesQuery(c, search)),
    [channels, search],
  );
  const privateChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "private" && matchesQuery(c, search)),
    [channels, search],
  );

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
    const unread = ch.unread_count > 0 && !active;
    return (
      <button
        key={ch.id}
        type="button"
        className={cn("team-chat-channel-row", active && "team-chat-channel-row--active")}
        onClick={() => onSelect(ch.id)}
      >
        <Icon className="team-chat-channel-icon size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{channelLabel(ch)}</span>
        {unread ? (
          <span className="team-chat-unread-badge" aria-label={`${ch.unread_count} ulæste`}>
            {ch.unread_count > 99 ? "99+" : ch.unread_count}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <aside className={cn("team-chat-channel-list", layout === "dock" && "team-chat-channel-list--dock")}>
      <div className="team-chat-sidebar-brand">
        <MessagesSquare className="size-5 shrink-0 text-star-blue" aria-hidden />
        <div className="min-w-0">
          <p className="team-chat-sidebar-title">STARchat</p>
          <p className="team-chat-sidebar-subtitle">Intern team-chat</p>
        </div>
      </div>

      <div className="team-chat-channel-search">
        <Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg kanaler…"
          className="team-chat-channel-search-input"
          aria-label="Søg kanaler"
        />
      </div>

      <div className="team-chat-channel-scroll">
        <div className="team-chat-channel-list-header">
          <span className="team-chat-section-label">Kanaler</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Opret kanal"
            onClick={() => {
              setCreateOpen((o) => !o);
              setDmOpen(false);
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        {createOpen ? (
          <div className="team-chat-channel-create">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kanalnavn"
              className="h-8 text-sm"
              disabled={busy}
            />
            <label className="team-chat-channel-private-label">
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
              className="h-8 w-full text-xs"
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

        <div className="team-chat-channel-list-header mt-3">
          <span className="team-chat-section-label">Direkte</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Ny besked"
            onClick={() => {
              setDmOpen((o) => !o);
              setCreateOpen(false);
            }}
          >
            <MessageCircle className="size-4" />
          </Button>
        </div>

        {dmOpen ? (
          <ul className="team-chat-dm-picker">
            {staff.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="team-chat-dm-pick"
                  disabled={busy}
                  onClick={() => fireAndForget(startDm(s.id))}
                >
                  <span className="team-chat-dm-avatar" aria-hidden>
                    {s.display_name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  {s.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="team-chat-channel-section">{dmChannels.map(renderRow)}</div>
      </div>

      {error ? (
        <p className="team-chat-channel-error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
