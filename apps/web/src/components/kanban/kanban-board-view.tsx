"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DispatchTeamsRail } from "@/components/dispatch/dispatch-teams-rail";
import { KanbanAddColumnDialog } from "@/components/kanban/kanban-add-column-dialog";
import { KanbanAddTicketDialog } from "@/components/kanban/kanban-add-ticket-dialog";
import { KanbanBoardSettings } from "@/components/kanban/kanban-board-settings";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { KanbanCloseBoardDialog } from "@/components/kanban/kanban-close-board-dialog";
import { KanbanCreateBoardDialog } from "@/components/kanban/kanban-create-board-dialog";
import { KanbanImportBacklogDialog } from "@/components/kanban/kanban-import-backlog-dialog";
import { KanbanQuickCreateDialog } from "@/components/kanban/kanban-quick-create-dialog";
import { KanbanTicketDrawer } from "@/components/kanban/kanban-ticket-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResizableSplit } from "@/components/ui/resizable-split";
import { useBoardDataSync } from "@/hooks/use-board-data-sync";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClickableMetric } from "@/components/dashboard/clickable-metric";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { buildTicketsFilterHref } from "@/lib/dashboard-ticket-links";
import { canManageUsers } from "@/lib/auth";
import {
  serviceDeskTeamIds,
  teamsForServiceDeskRail,
} from "@/lib/service-desk-queue";
import { partitionTeamsByCategory, sortTeamsForDisplay } from "@/lib/team-categories";
import {
  buildOpenAssignedTicketsByTeamMap,
  TEAM_GROUP_PREVIEW_LIMIT,
} from "@/lib/team-group-view";
import { readDraggedTicketId as readExternalTicketId } from "@/lib/ticket-drag";
import type { Category } from "@/types/category";
import type { Ticket } from "@/types/ticket";
import type {
  KanbanBoardDetail,
  KanbanBoardSummary,
  KanbanCard as KanbanCardData,
  KanbanColumn,
} from "@/types/kanban";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

const KANBAN_CARD_DRAG_TYPE = "application/x-stardesk-kanban-ticket";

function readKanbanDropPayload(dataTransfer: DataTransfer): {
  ticketId: string;
  fromBoard: boolean;
} {
  const fromBoard = dataTransfer.getData(KANBAN_CARD_DRAG_TYPE);
  if (fromBoard) {
    return { ticketId: fromBoard, fromBoard: true };
  }
  const external = readExternalTicketId(dataTransfer);
  return { ticketId: external, fromBoard: false };
}

function filterTicketsByTeamExcluding(
  map: Map<string, Ticket[]>,
  excludeIds: Set<string>,
): Map<string, Ticket[]> {
  if (excludeIds.size === 0) {
    return map;
  }
  const next = new Map<string, Ticket[]>();
  for (const [teamId, list] of map) {
    const filtered = list.filter((t) => !excludeIds.has(t.id));
    if (filtered.length > 0) {
      next.set(teamId, filtered);
    }
  }
  return next;
}

function firstColumnId(detail: KanbanBoardDetail): string | null {
  return detail.columns[0]?.column.id ?? null;
}

function backlogColumnId(detail: KanbanBoardDetail): string | null {
  const exact = detail.columns.find(
    ({ column }) => column.name.trim().toLowerCase() === "backlog",
  );
  if (exact) return exact.column.id;
  return firstColumnId(detail);
}

function wipHint(column: KanbanColumn, count: number): string | null {
  if (column.wip_limit == null) {
    return null;
  }
  if (count >= column.wip_limit) {
    return `WIP: ${count}/${column.wip_limit}`;
  }
  return null;
}

const COLUMN_ACCENT = [
  "border-t-star-blue",
  "border-t-amber-500",
  "border-t-emerald-500",
  "border-t-violet-500",
  "border-t-rose-500",
  "border-t-cyan-500",
] as const;

function moveCardOptimistically(
  detail: KanbanBoardDetail,
  ticketId: string,
  targetColumnId: string,
): KanbanBoardDetail {
  let moved: KanbanCardData | null = null;
  const columns = detail.columns.map(({ column, cards }) => {
    const remaining = cards.filter(({ ticket }) => {
      if (ticket.id === ticketId) {
        moved = { ticket, position: cards.length };
        return false;
      }
      return true;
    });
    return { column, cards: remaining };
  });
  if (!moved) {
    return detail;
  }
  return {
    ...detail,
    columns: columns.map(({ column, cards }) =>
      column.id === targetColumnId
        ? { column, cards: [...cards, { ...moved!, position: cards.length }] }
        : { column, cards },
    ),
  };
}

export function KanbanBoardView({
  initialDetail,
  boards,
  teams,
  users,
  currentUser,
  initialTickets = [],
}: {
  initialDetail: KanbanBoardDetail;
  boards: KanbanBoardSummary[];
  teams: Team[];
  users: User[];
  currentUser: User | null;
  initialTickets?: Ticket[];
}) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [importBacklogOpen, setImportBacklogOpen] = useState(false);
  const [closeBoardOpen, setCloseBoardOpen] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [localTickets, setLocalTickets] = useState<Ticket[]>(initialTickets);
  const [groupsRailOpen, setGroupsRailOpen] = useState(true);

  const { refreshNow } = useBoardDataSync({ setTickets: setLocalTickets });

  useEffect(() => {
    setLocalTickets(initialTickets);
  }, [initialTickets]);

  useEffect(() => {
    fireAndForget(refreshNow());
  }, [refreshNow]);

  const showAdminPicker = canManageUsers(currentUser);
  const canEdit = detail.can_edit;
  const canCloseBoard = detail.can_delete_board;
  const canDropOnColumns = detail.can_move_cards || canEdit;

  const totalCards = useMemo(
    () => detail.columns.reduce((sum, col) => sum + col.cards.length, 0),
    [detail.columns],
  );

  const ticketIdsOnBoard = useMemo(
    () =>
      new Set(
        detail.columns.flatMap(({ cards }) => cards.map(({ ticket }) => ticket.id)),
      ),
    [detail.columns],
  );

  const railTeams = useMemo(() => {
    const { internal } = partitionTeamsByCategory(teams);
    const sorted = sortTeamsForDisplay(internal);
    const deskIds = serviceDeskTeamIds(sorted);
    return teamsForServiceDeskRail(sorted, deskIds);
  }, [teams]);

  const ticketsByTeam = useMemo(() => {
    const map = buildOpenAssignedTicketsByTeamMap(localTickets);
    return filterTicketsByTeamExcluding(map, ticketIdsOnBoard);
  }, [localTickets, ticketIdsOnBoard]);

  const refreshBoard = useCallback(async () => {
    const refreshed = await apiGet<KanbanBoardDetail>(
      `/api/v1/kanban/boards/${detail.board.id}`,
    );
    setDetail(refreshed);
  }, [detail.board.id]);

  async function handleDrop(columnId: string, event: React.DragEvent) {
    event.preventDefault();
    setDragOverColumnId(null);
    const { ticketId, fromBoard } = readKanbanDropPayload(event.dataTransfer);
    setDraggingTicketId(null);
    if (!ticketId) {
      return;
    }

    const isOnBoard = fromBoard || ticketIdsOnBoard.has(ticketId);
    if (isOnBoard) {
      if (!detail.can_move_cards) {
        return;
      }
      setMoveError(null);
      const previous = detail;
      setDetail((current) => moveCardOptimistically(current, ticketId, columnId));
      try {
        await apiPatch(`/api/v1/kanban/boards/${detail.board.id}/cards/${ticketId}/move`, {
          column_id: columnId,
        });
        await refreshBoard();
      } catch (err) {
        setDetail(previous);
        setMoveError(err instanceof Error ? err.message : "Kunne ikke flytte kort.");
      }
      return;
    }

    if (!canEdit) {
      return;
    }
    setMoveError(null);
    try {
      await apiPost(`/api/v1/kanban/boards/${detail.board.id}/cards`, {
        column_id: columnId,
        ticket_id: ticketId,
      });
      await refreshBoard();
      await refreshNow();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke tilføje sag til board.");
    }
  }

  async function handleRemoveFromBoard(ticketId: string) {
    try {
      await apiDelete(`/api/v1/kanban/boards/${detail.board.id}/cards/${ticketId}`);
      await refreshBoard();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke fjerne kort.");
    }
  }

  async function handleDeleteTicket(ticketId: string) {
    try {
      await apiDelete(
        `/api/v1/kanban/boards/${detail.board.id}/cards/${ticketId}?delete_ticket=true`,
      );
      await refreshBoard();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke slette sag.");
    }
  }

  async function handleAddColumn(name: string) {
    await apiPost(`/api/v1/kanban/boards/${detail.board.id}/columns`, {
      name,
      position: detail.columns.length,
    });
    await refreshBoard();
  }

  async function handleRenameColumn(columnId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingColumnId(null);
      return;
    }
    try {
      await apiPatch(`/api/v1/kanban/boards/${detail.board.id}/columns/${columnId}`, {
        name: trimmed,
      });
      setRenamingColumnId(null);
      await refreshBoard();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke omdøbe kolonne.");
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (!window.confirm("Slet kolonnen? Den skal være tom.")) {
      return;
    }
    try {
      await apiDelete(`/api/v1/kanban/boards/${detail.board.id}/columns/${columnId}`);
      setColumnMenuId(null);
      await refreshBoard();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke slette kolonne.");
    }
  }

  function openQuickCreate(columnId?: string) {
    setTargetColumnId(columnId ?? firstColumnId(detail));
    setQuickCreateOpen(true);
  }

  function openAddExisting(columnId?: string) {
    setTargetColumnId(columnId ?? firstColumnId(detail));
    setAddOpen(true);
  }

  async function handleImportBacklogIdeas(
    ideas: Array<{ title: string; description: string }>,
  ) {
    const targetId = backlogColumnId(detail);
    if (!targetId) {
      throw new Error("Boardet har ingen kolonner. Opret Backlog først.");
    }
    for (const idea of ideas) {
      await apiPost(`/api/v1/kanban/boards/${detail.board.id}/cards`, {
        column_id: targetId,
        ticket: {
          title: idea.title,
          description: idea.description,
          ticket_type: "incident",
          priority: "medium",
        },
      });
    }
    await refreshBoard();
  }

  const groupsRail =
    railTeams.length > 0 ? (
      <DispatchTeamsRail
        teams={railTeams}
        ticketsByTeam={ticketsByTeam}
        dragOverTeamId={null}
        onDragOverTeam={() => {}}
        onDragLeaveTeam={() => {}}
        onDropTeam={() => {}}
        title="Interne grupper"
        description="Fold grupper ud/luk med pil — træk sag til en kolonne på boardet"
        panelOpen={groupsRailOpen}
        onTogglePanel={() => setGroupsRailOpen((open) => !open)}
        ticketSourceMode
        previewLimit={TEAM_GROUP_PREVIEW_LIMIT}
      />
    ) : null;

  const boardBody = (
    <>
      {moveError ? <p className="text-destructive px-1 text-sm">{moveError}</p> : null}

      {totalCards === 0 && detail.columns.length > 0 ? (
        <section className="ledger-card mx-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-muted-foreground max-w-md text-sm">
            Boardet er tomt. Træk sager fra <strong>Interne grupper</strong> til en kolonne, mellem
            kolonner på boardet, eller opret med <strong>Ny sag</strong> / <strong>Tilføj sag</strong>
            .
          </p>
          {canEdit ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" onClick={() => openQuickCreate()}>
                Ny sag
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => openAddExisting()}>
                Tilføj eksisterende sag
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {detail.columns.length === 0 ? (
        <section className="ledger-card mx-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
          <p className="text-muted-foreground max-w-sm text-sm">
            Dette board har ingen kolonner endnu. Tilføj den første kolonne for at komme i gang —
            fx &quot;Backlog&quot;, &quot;I gang&quot; eller &quot;Færdig&quot;.
          </p>
          {canEdit ? (
            <Button type="button" onClick={() => setAddColumnOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Tilføj første kolonne
            </Button>
          ) : null}
        </section>
      ) : (
        <div
          className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4 px-1"
          role="list"
          aria-label="Kanban-kolonner"
        >
          {detail.columns.map(({ column, cards }, columnIndex) => {
            const wip = wipHint(column, cards.length);
            const accent = COLUMN_ACCENT[columnIndex % COLUMN_ACCENT.length];
            const isDropTarget = dragOverColumnId === column.id;
            return (
              <section
                key={column.id}
                role="listitem"
                className={`flex w-80 shrink-0 flex-col rounded-xl border border-[var(--gray-border)] border-t-[3px] bg-card shadow-sm transition-shadow ${accent} ${
                  isDropTarget ? "ring-2 ring-star-blue/40 shadow-md" : ""
                }`}
                onDragOver={(event) => {
                  if (!canDropOnColumns) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverColumnId(column.id);
                }}
                onDragLeave={() => {
                  if (dragOverColumnId === column.id) {
                    setDragOverColumnId(null);
                  }
                }}
                onDrop={(event) => handleDrop(column.id, event)}
              >
                <header className="border-b border-[var(--gray-border)] px-3 py-2.5">
                  <div className="flex items-start justify-between gap-1">
                    {renamingColumnId === column.id ? (
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => fireAndForget(handleRenameColumn(column.id))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            fireAndForget(handleRenameColumn(column.id));
                          }
                          if (e.key === "Escape") {
                            setRenamingColumnId(null);
                          }
                        }}
                        className="h-7 text-sm"
                        autoFocus
                      />
                    ) : (
                      <div
                        className="min-w-0 flex-1 cursor-text"
                        onDoubleClick={() => {
                          if (!canEdit) return;
                          setRenameValue(column.name);
                          setRenamingColumnId(column.id);
                        }}
                        title={canEdit ? "Dobbeltklik for at omdøbe" : undefined}
                      >
                        <h2 className="text-sm font-semibold">{column.name}</h2>
                        <p className="text-muted-foreground text-[10px]">
                          <ClickableMetric
                            href={
                              cards.length > 0 && column.statuses[0]
                                ? buildTicketsFilterHref({
                                    scope: "all",
                                    status: column.statuses[0],
                                    openOnly: true,
                                  })
                                : undefined
                            }
                            inline
                            ariaLabel={`${column.name}: ${cards.length} sager`}
                          >
                            {cards.length} sager
                          </ClickableMetric>
                          {column.wip_limit != null ? ` · max ${column.wip_limit}` : ""}
                        </p>
                        {wip ? (
                          <p className="text-amber-600 text-[10px] font-medium">{wip}</p>
                        ) : null}
                      </div>
                    )}
                    {canEdit ? (
                      <div className="relative">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`Kolonne-menu for ${column.name}`}
                          onClick={() =>
                            setColumnMenuId((id) => (id === column.id ? null : column.id))
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                        {columnMenuId === column.id ? (
                          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-[var(--gray-border)] bg-popover py-1 text-xs shadow-md">
                            <button
                              type="button"
                              className="hover:bg-muted block w-full px-3 py-1.5 text-left"
                              onClick={() => {
                                setRenameValue(column.name);
                                setRenamingColumnId(column.id);
                                setColumnMenuId(null);
                              }}
                            >
                              Omdøb
                            </button>
                            {column.is_custom ? (
                              <button
                                type="button"
                                className="text-destructive hover:bg-muted block w-full px-3 py-1.5 text-left"
                                onClick={() => fireAndForget(handleDeleteColumn(column.id))}
                              >
                                Slet kolonne
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </header>
                <div
                  className={`flex max-h-[calc(100vh-16rem)] min-h-[14rem] flex-1 flex-col gap-2 overflow-y-auto p-2.5 transition-colors ${
                    isDropTarget ? "bg-star-blue/8" : "bg-muted/15"
                  }`}
                >
                  {isDropTarget && canDropOnColumns ? (
                    <div className="border-star-blue/40 bg-star-blue/5 text-star-blue mb-1 rounded-md border border-dashed px-2 py-3 text-center text-xs font-medium">
                      Slip kortet her
                    </div>
                  ) : null}
                  {cards.length === 0 && !isDropTarget ? (
                    <p className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-center text-xs">
                      Træk sager hertil
                    </p>
                  ) : (
                    cards.map(({ ticket }) => (
                      <KanbanCard
                        key={ticket.id}
                        ticket={ticket}
                        dragging={draggingTicketId === ticket.id}
                        canRemove={detail.can_remove_cards}
                        canDeleteTicket={detail.can_delete_tickets}
                        onDragStart={() => setDraggingTicketId(ticket.id)}
                        onDragEnd={() => setDraggingTicketId(null)}
                        onRemoveFromBoard={() =>
                          fireAndForget(handleRemoveFromBoard(ticket.id))
                        }
                        onDeleteTicket={() => fireAndForget(handleDeleteTicket(ticket.id))}
                        onOpen={() => {
                          setSelectedTicketId(ticket.id);
                          if (categories.length === 0) {
                            apiGet<Category[]>("/api/v1/categories")
                              .then(setCategories)
                              .catch(() => {});
                          }
                        }}
                      />
                    ))
                  )}
                  {canEdit ? (
                    <div className="mt-auto flex gap-1 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => openQuickCreate(column.id)}
                      >
                        + Ny sag
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
          {canEdit ? (
            <section className="flex w-44 shrink-0 items-start pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-start gap-2 border-dashed text-muted-foreground hover:border-star-blue/40 hover:text-foreground"
                aria-label="Tilføj kolonne"
                onClick={() => setAddColumnOpen(true)}
              >
                <Plus className="size-4" />
                Ny kolonne
              </Button>
            </section>
          ) : null}
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="star-page-title truncate">{detail.board.name}</h1>
          {detail.board.team_name ? (
            <span className="text-muted-foreground text-xs">· Filter: {detail.board.team_name}</span>
          ) : (
            <span className="text-muted-foreground text-xs">· Alle grupper</span>
          )}
          <span className="text-muted-foreground text-xs">· {totalCards} sager på board</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <>
              <Button type="button" size="sm" onClick={() => openQuickCreate()}>
                Ny sag
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => openAddExisting()}>
                Tilføj sag
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportBacklogOpen(true)}
              >
                Importér backlog-liste
              </Button>
            </>
          ) : null}
          <Select
            value={detail.board.id}
            onValueChange={(id) => router.push(`/kanban/${id}`)}
          >
            <SelectTrigger className="w-[200px]" aria-label="Vælg board">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {boards.map((board) => (
                <SelectItem key={board.id} value={board.id}>
                  {board.name}
                  {showAdminPicker && board.my_role ? ` (${board.my_role})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            Nyt board
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              Indstillinger
            </Button>
          ) : null}
          {canCloseBoard ? (
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Board-handlinger"
                aria-expanded={boardMenuOpen}
                onClick={() => setBoardMenuOpen((open) => !open)}
              >
                <MoreHorizontal className="size-4" />
              </Button>
              {boardMenuOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Luk menu"
                    onClick={() => setBoardMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-[var(--gray-border)] bg-popover py-1 text-sm shadow-md">
                    <button
                      type="button"
                      className="text-destructive hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left"
                      onClick={() => {
                        setBoardMenuOpen(false);
                        setCloseBoardOpen(true);
                      }}
                    >
                      <Archive className="size-4" />
                      Luk board
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <Link
            href="/kanban"
            className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-muted"
          >
            Alle boards
          </Link>
        </div>
      </header>

      {settingsOpen && canEdit ? (
        <KanbanBoardSettings
          detail={detail}
          teams={teams}
          users={users}
          onUpdated={setDetail}
          onDeleted={() => router.push("/kanban")}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {groupsRail && groupsRailOpen ? (
        <ResizableSplit
          storageKey="stardesk-kanban-teams-split"
          defaultSizes={[28, 72]}
          minSizes={[22, 45]}
          className="min-h-0 flex-1 gap-3"
        >
          {groupsRail}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{boardBody}</div>
        </ResizableSplit>
      ) : (
        <div className="flex min-h-0 flex-1 gap-2">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{boardBody}</div>
          {groupsRail && !groupsRailOpen ? (
            <Button
              type="button"
              variant="outline"
              className="border-star-red/40 text-star-navy hover:bg-star-blue-light/60 flex h-auto w-11 shrink-0 flex-col gap-2 self-stretch rounded-none border-l-[3px] border-y-0 border-r-0 px-1 py-4 text-[10px] font-bold tracking-wide uppercase"
              onClick={() => setGroupsRailOpen(true)}
              aria-label="Vis interne grupper"
              title="Vis interne grupper"
            >
              <span className="text-base leading-none" aria-hidden>
                ◀
              </span>
              <span className="[writing-mode:vertical-rl] rotate-180">Vis grupper</span>
            </Button>
          ) : null}
        </div>
      )}

      <KanbanAddColumnDialog
        open={addColumnOpen}
        onClose={() => setAddColumnOpen(false)}
        onAdd={handleAddColumn}
      />

      <KanbanTicketDrawer
        ticketId={selectedTicketId}
        teams={teams}
        categories={categories}
        currentUser={currentUser}
        onClose={() => setSelectedTicketId(null)}
      />

      <KanbanCreateBoardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(boardId) => {
          setCreateOpen(false);
          router.push(`/kanban/${boardId}`);
        }}
      />

      <KanbanAddTicketDialog
        open={addOpen}
        boardId={detail.board.id}
        columnId={targetColumnId}
        onClose={() => setAddOpen(false)}
        onAdded={() => fireAndForget(refreshBoard())}
      />

      <KanbanCloseBoardDialog
        open={closeBoardOpen}
        boardId={detail.board.id}
        boardName={detail.board.name}
        onClose={() => setCloseBoardOpen(false)}
        onClosed={() => router.push("/kanban")}
      />

      <KanbanQuickCreateDialog
        open={quickCreateOpen}
        boardId={detail.board.id}
        columnId={targetColumnId}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={() => fireAndForget(refreshBoard())}
      />

      <KanbanImportBacklogDialog
        open={importBacklogOpen}
        onClose={() => setImportBacklogOpen(false)}
        onImport={handleImportBacklogIdeas}
      />
    </div>
  );
}
