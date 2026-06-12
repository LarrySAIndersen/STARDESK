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
  WorkspaceLandingSitemap,
  WorkspaceWidgetFocusHeader,
} from "@/components/workspace-landing/workspace-landing-sitemap";
import { WorkspaceLandingSideNav } from "@/components/workspace-landing/workspace-landing-side-nav";
import {
  WorkspaceLandingToolbar,
  WorkspaceWidgetShell,
} from "@/components/workspace-landing/workspace-landing-toolbar";
import {
  applySpaceWidgetUpdate,
  buildWorkspaceHref,
  createWidgetInstance,
  hideWidgetInstance,
  moveWidgetInstance,
  needsPostItProvider,
  parseWorkspaceSpace,
  parseWorkspaceView,
  toggleWidgetSpan,
  visibleWidgetInstances,
  WORKSPACE_SITEMAP_PATH,
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
  const searchParamsString = searchParams.toString();
  const initialSpace = parseWorkspaceSpace(searchParams.get("space"));
  const initialView = parseWorkspaceView(searchParams.get("view"), searchParams.get("widget"));
  const widgetParam = searchParams.get("widget");

  const [space, setSpace] = useState<WorkspaceSpace>(initialSpace);
  const [view, setView] = useState(initialView);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<WorkspaceLandingConfig>(() =>
    readWorkspaceLanding(user.id),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [kanban, setKanban] = useState(initialKanban);

  useEffect(() => {
    if (searchParams.get("view") === "sitemap") {
      router.replace(WORKSPACE_SITEMAP_PATH);
      return;
    }
    setSpace(parseWorkspaceSpace(searchParams.get("space")));
    setView(parseWorkspaceView(searchParams.get("view"), searchParams.get("widget")));
  }, [searchParams, router]);

  useEffect(() => {
    if (view !== "grid" && editMode) {
      setEditMode(false);
    }
  }, [view, editMode]);

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
      router.replace(
        buildWorkspaceHref({
          space: next,
          view,
          widgetInstanceId: view === "widget" ? widgetParam ?? undefined : undefined,
          preserveParams: searchParamsString,
        }),
        { scroll: false },
      );
    },
    [router, searchParamsString, view, widgetParam],
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

  const focusedWidget = useMemo(() => {
    if (view !== "widget" || !widgetParam) {
      return null;
    }
    return visibleWidgets.find((item) => item.instanceId === widgetParam) ?? null;
  }, [view, widgetParam, visibleWidgets]);

  const showPostItProvider = needsPostItProvider(
    view === "widget" && focusedWidget ? [focusedWidget] : visibleWidgets,
  );

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
    <div className="flex min-h-0 flex-1">
      <WorkspaceLandingSideNav
        space={space}
        view={view}
        widgets={layout[space]}
        activeWidgetId={focusedWidget?.instanceId}
        searchParams={searchParamsString}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {view === "grid" ? (
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
        ) : null}
        <div className="wire-scroll-content min-h-0 flex-1 p-5">
          {view === "widget" && focusedWidget ? (
            <div className="workspace-widget-focus">
              <WorkspaceWidgetFocusHeader
                instance={focusedWidget}
                space={space}
                fromParam={searchParams.get("from")}
                searchParams={searchParamsString}
              />
              <div className="workspace-widget-focus__content mt-4 rounded border border-[var(--gray-border)] bg-card p-4 sm:p-5">
                {showPostItProvider ? (
                  <PostItAttachProvider
                    onNoteUpdated={(note) =>
                      setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)))
                    }
                  >
                    {renderWidget(focusedWidget)}
                  </PostItAttachProvider>
                ) : (
                  renderWidget(focusedWidget)
                )}
              </div>
            </div>
          ) : null}

          {view === "widget" && !focusedWidget ? (
            <div className="workspace-landing-empty rounded border border-dashed border-[var(--gray-border)] bg-muted/20 p-8 text-center">
              <p className="text-muted-foreground text-sm">
                Elementet findes ikke eller er skjult. Gå tilbage til overblikket.
              </p>
              <Link
                href={buildWorkspaceHref({ space, view: "grid", preserveParams: searchParamsString })}
                className="text-star-blue mt-3 inline-block text-sm font-medium hover:underline"
              >
                Tilbage til overblik
              </Link>
            </div>
          ) : null}

          {view === "grid" ? (
            showPostItProvider ? (
              <PostItAttachProvider
                onNoteUpdated={(note) =>
                  setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)))
                }
              >
                {widgetGrid}
              </PostItAttachProvider>
            ) : (
              widgetGrid
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
