"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AgentDashboardClient } from "@/components/agent-dashboard-client";
import { AgentOperationsHome } from "@/components/agent-operations-home";
import { PostItAttachProvider } from "@/components/personal/post-it-attach-provider";
import { PersonalBoard } from "@/components/personal/personal-board";
import { MyTicketsSection, PersonalKanbanBoard } from "@/components/personal/personal-kanban-board";
import { ChatChannelList } from "@/components/team-chat/chat-channel-list";
import { useChatWorkspace } from "@/components/team-chat/chat-workspace-provider";
import {
  WorkspaceLandingToolbar,
  WorkspaceWidgetShell,
} from "@/components/workspace-landing/workspace-landing-toolbar";
import {
  applySpaceWidgetUpdate,
  buildSpaceHref,
  createWidgetInstance,
  hideWidgetInstance,
  moveWidgetInstance,
  needsPostItProvider,
  parseWorkspaceSpace,
  toggleWidgetSpan,
  visibleWidgetInstances,
} from "@/lib/workspace-landing/layout-utils";
import {
  readWorkspaceLanding,
  resetWorkspaceLanding,
  writeWorkspaceLanding,
} from "@/lib/workspace-landing/storage";
import type {
  WorkspaceLandingConfig,
  WorkspaceSpace,
  WorkspaceWidgetInstance,
  WorkspaceWidgetKind,
} from "@/lib/workspace-landing/types";
import { loadTeamChatDirectory, loadTeamChatStaff } from "@/lib/team-chat/directory";
import { cn } from "@/lib/utils";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban, type PersonalNote } from "@/types/personal";
import type { UserTicketsGrouped } from "@/types/admin-user";
import type { OperationsDashboard } from "@/types/dashboard";
import type { Team } from "@/types/team";
import type { TeamChatChannel, TeamChatStaff } from "@/types/team-chat";
import type { Ticket } from "@/types/ticket";
import type { User } from "@/types/user";

type WorkspaceLandingClientProps = Readonly<{
  user: User;
  personalDashboard: OperationsDashboard;
  teamDashboard: OperationsDashboard;
  tickets: Ticket[];
  teams: Team[];
  initialNotes: PersonalNote[];
  initialKanban: PersonalKanban;
  userTickets: UserTicketsGrouped;
  assignableTickets: Ticket[];
  notesLoadFailed: boolean;
}>;

function TeamChatWidgetPreview() {
  const router = useRouter();
  const { setActiveChannelId } = useChatWorkspace();
  const [channels, setChannels] = useState<TeamChatChannel[]>([]);
  const [staff, setStaff] = useState<TeamChatStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fireAndForget(
      (async () => {
        setLoading(true);
        try {
          const { channels: channelData, staff: staffData } = await loadTeamChatDirectory();
          setChannels(channelData);
          setStaff(staffData);
        } catch {
          setError("Kunne ikke hente teamchat.");
        } finally {
          setLoading(false);
        }
      })(),
    );
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Henter kanaler…</p>;
  }
  if (error) {
    return <p className="text-star-red text-sm">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <ChatChannelList
        channels={channels}
        activeChannelId={null}
        staff={staff}
        onSelect={(id) => {
          setActiveChannelId(id);
          router.push("/chat");
        }}
        onChannelCreated={(ch) => setChannels((prev) => [...prev, ch])}
        onDmCreated={(ch) => setChannels((prev) => [...prev, ch])}
      />
      <div className="flex flex-wrap gap-2">
        <Link
          href="/chat"
          className="border-input bg-background hover:bg-accent inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium"
        >
          Åbn teamchat
        </Link>
      </div>
    </div>
  );
}

function TeamMembersWidget() {
  const [staff, setStaff] = useState<TeamChatStaff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fireAndForget(
      loadTeamChatStaff().then(setStaff).finally(() => setLoading(false)),
    );
  }, []);

  if (loading) {
    return <p className="text-muted-foreground text-sm">Henter kollegaer…</p>;
  }

  if (staff.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen teammedlemmer fundet.</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {staff.slice(0, 8).map((member) => (
        <li
          key={member.id}
          className="flex flex-col rounded border border-[var(--gray-border)] bg-white px-3 py-2 text-sm"
        >
          <span className="truncate font-medium">{member.display_name}</span>
          <span className="text-muted-foreground truncate text-xs">{member.email}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceLandingClient({
  user,
  personalDashboard,
  teamDashboard,
  tickets,
  teams,
  initialNotes,
  initialKanban,
  userTickets,
  assignableTickets,
  notesLoadFailed,
}: WorkspaceLandingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSpace = parseWorkspaceSpace(searchParams.get("space"));

  const [space, setSpace] = useState<WorkspaceSpace>(initialSpace);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<WorkspaceLandingConfig>(() =>
    readWorkspaceLanding(user.id),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [kanban, setKanban] = useState(initialKanban);

  useEffect(() => {
    setSpace(parseWorkspaceSpace(searchParams.get("space")));
  }, [searchParams]);

  const persistLayout = useCallback(
    (next: WorkspaceLandingConfig) => {
      setLayout(next);
      writeWorkspaceLanding(user.id, next);
    },
    [user.id],
  );

  const updateSpaceWidgets = useCallback(
    (spaceKey: WorkspaceSpace, updater: (items: WorkspaceWidgetInstance[]) => WorkspaceWidgetInstance[]) => {
      persistLayout(applySpaceWidgetUpdate(layout, spaceKey, updater));
    },
    [layout, persistLayout],
  );

  const handleSpaceChange = useCallback(
    (next: WorkspaceSpace) => {
      setSpace(next);
      router.replace(buildSpaceHref(next, searchParams.toString()), { scroll: false });
    },
    [router, searchParams],
  );

  const handleAddWidget = useCallback(
    (kind: WorkspaceWidgetKind) => {
      updateSpaceWidgets(space, (items) => [...items, createWidgetInstance(kind, items)]);
    },
    [space, updateSpaceWidgets],
  );

  const handleResetLayout = useCallback(() => {
    persistLayout(resetWorkspaceLanding(user.id));
  }, [persistLayout, user.id]);

  const refreshKanban = useCallback(async () => {
    const res = await fetch("/api/proxy/v1/personal/kanban", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as PersonalKanban;
    setKanban(data);
  }, []);

  const visibleWidgets = useMemo(
    () => visibleWidgetInstances(layout[space]),
    [layout, space],
  );

  const showPostItProvider = needsPostItProvider(visibleWidgets);

  const renderWidget = (instance: WorkspaceWidgetInstance) => {
    switch (instance.kind) {
      case "personal-dashboard":
        return (
          <AgentOperationsHome
            initialDashboard={personalDashboard}
            initialScope="personal"
            user={user}
            embedded
          />
        );
      case "dispatch-queue":
      case "team-dispatch":
        return <AgentDashboardClient tickets={tickets} teams={teams} />;
      case "personal-notes":
        return (
          <PersonalBoard
            notes={notes}
            onNotesChange={setNotes}
            kanban={kanban}
            onKanbanRefresh={refreshKanban}
            notesLoadFailed={notesLoadFailed}
          />
        );
      case "personal-kanban":
        return (
          <PersonalKanbanBoard
            kanban={kanban}
            assignableTickets={assignableTickets}
            hiddenColumns={[PERSONAL_KANBAN_COLUMNS[0]]}
            onKanbanChange={setKanban}
          />
        );
      case "my-tickets":
        return (
          <MyTicketsSection
            userTickets={userTickets}
            boardTicketIds={new Set(kanban.cards.map((c) => c.ticket_id))}
          />
        );
      case "team-dashboard":
        return (
          <AgentOperationsHome
            initialDashboard={teamDashboard}
            initialScope="group"
            user={user}
            embedded
          />
        );
      case "team-chat":
        return <TeamChatWidgetPreview />;
      case "team-members":
        return <TeamMembersWidget />;
      default:
        return null;
    }
  };

  const widgetGrid = (
    <div className={cn("workspace-landing-grid", editMode && "workspace-landing-grid--edit")}>
      {visibleWidgets.length === 0 ? (
        <div className="workspace-landing-empty rounded border border-dashed border-[var(--gray-border)] bg-muted/20 p-8 text-center">
          <p className="text-muted-foreground text-sm">
            Ingen widgets endnu. Brug &quot;Tilføj widget&quot; ovenfor.
          </p>
        </div>
      ) : (
        visibleWidgets.map((instance) => (
          <WorkspaceWidgetShell
            key={instance.instanceId}
            instance={instance}
            editMode={editMode}
            onMove={(direction) => {
              updateSpaceWidgets(space, (items) =>
                moveWidgetInstance(items, instance.instanceId, direction),
              );
            }}
            onToggleSpan={() => {
              updateSpaceWidgets(space, (items) =>
                toggleWidgetSpan(items, instance.instanceId),
              );
            }}
            onHide={() => {
              updateSpaceWidgets(space, (items) =>
                hideWidgetInstance(items, instance.instanceId),
              );
            }}
          >
            {renderWidget(instance)}
          </WorkspaceWidgetShell>
        ))
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WorkspaceLandingToolbar
        space={space}
        onSpaceChange={handleSpaceChange}
        editMode={editMode}
        onEditModeChange={setEditMode}
        widgets={layout[space]}
        onAddWidget={handleAddWidget}
        onResetLayout={handleResetLayout}
        userDisplayName={user.display_name}
      />
      <div className="wire-scroll-content min-h-0 flex-1 p-5">
        {showPostItProvider ? (
          <PostItAttachProvider
            onNoteUpdated={(note) =>
              setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)))
            }
          >
            {widgetGrid}
          </PostItAttachProvider>
        ) : (
          widgetGrid
        )}
      </div>
    </div>
  );
}
