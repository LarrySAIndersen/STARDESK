"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { KanbanAddTicketDialog } from "@/components/kanban/kanban-add-ticket-dialog";
import { KanbanBoardSettings } from "@/components/kanban/kanban-board-settings";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { KanbanCreateBoardDialog } from "@/components/kanban/kanban-create-board-dialog";
import { KanbanQuickCreateDialog } from "@/components/kanban/kanban-quick-create-dialog";
import { KanbanTicketDrawer } from "@/components/kanban/kanban-ticket-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { canManageUsers } from "@/lib/auth";
import type { Category } from "@/types/category";
import type { KanbanBoardDetail, KanbanBoardSummary, KanbanColumn } from "@/types/kanban";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

function readDraggedTicketId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData("application/x-stardesk-kanban-ticket") ||
    dataTransfer.getData("text/plain") ||
    ""
  );
}

function firstColumnId(detail: KanbanBoardDetail): string | null {
  return detail.columns[0]?.column.id ?? null;
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

export function KanbanBoardView({
  initialDetail,
  boards,
  teams,
  users,
  currentUser,
}: {
  initialDetail: KanbanBoardDetail;
  boards: KanbanBoardSummary[];
  teams: Team[];
  users: User[];
  currentUser: User | null;
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
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const showAdminPicker = canManageUsers(currentUser);
  const canEdit = detail.can_edit;

  const totalCards = useMemo(
    () => detail.columns.reduce((sum, col) => sum + col.cards.length, 0),
    [detail.columns],
  );

  const refreshBoard = useCallback(async () => {
    const refreshed = await apiGet<KanbanBoardDetail>(
      `/api/v1/kanban/boards/${detail.board.id}`,
    );
    setDetail(refreshed);
  }, [detail.board.id]);

  async function handleDrop(columnId: string, event: React.DragEvent) {
    event.preventDefault();
    setDragOverColumnId(null);
    const ticketId = readDraggedTicketId(event.dataTransfer);
    setDraggingTicketId(null);
    if (!ticketId || !detail.can_move_cards) {
      return;
    }
    setMoveError(null);
    try {
      await apiPatch(`/api/v1/kanban/boards/${detail.board.id}/cards/${ticketId}/move`, {
        column_id: columnId,
      });
      await refreshBoard();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke flytte kort.");
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

  async function handleAddColumn(afterPosition?: number) {
    const name = window.prompt("Navn på ny kolonne:");
    if (!name?.trim()) {
      return;
    }
    try {
      await apiPost(`/api/v1/kanban/boards/${detail.board.id}/columns`, {
        name: name.trim(),
        position: afterPosition,
      });
      await refreshBoard();
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Kunne ikke oprette kolonne.");
    }
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

      {moveError ? <p className="text-destructive px-1 text-sm">{moveError}</p> : null}

      {totalCards === 0 ? (
        <section className="ledger-card mx-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-muted-foreground max-w-md text-sm">
            Boardet er tomt. Tilføj sager manuelt med <strong>Tilføj sag</strong> eller opret nye
            med <strong>Ny sag</strong>. Gruppe-filter bruges kun ved søgning — sager vises ikke
            automatisk.
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

      <div
        className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4 px-1"
        role="list"
        aria-label="Kanban-kolonner"
      >
        {detail.columns.map(({ column, cards }) => {
          const wip = wipHint(column, cards.length);
          return (
            <section
              key={column.id}
              role="listitem"
              className="flex w-72 shrink-0 flex-col rounded-lg border border-[var(--gray-border)] bg-muted/20"
              onDragOver={(event) => {
                if (!detail.can_move_cards) {
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
                      onBlur={() => void handleRenameColumn(column.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleRenameColumn(column.id);
                        }
                        if (e.key === "Escape") {
                          setRenamingColumnId(null);
                        }
                      }}
                      className="h-7 text-sm"
                      autoFocus
                    />
                  ) : (
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold">{column.name}</h2>
                      <p className="text-muted-foreground text-[10px]">
                        {cards.length} sager
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
                              onClick={() => void handleDeleteColumn(column.id)}
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
                className={`flex max-h-[calc(100vh-16rem)] min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto p-2 ${
                  dragOverColumnId === column.id ? "bg-star-blue/5 ring-1 ring-star-blue/30" : ""
                }`}
              >
                {cards.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    Ingen sager her endnu
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
                      onRemoveFromBoard={() => void handleRemoveFromBoard(ticket.id)}
                      onDeleteTicket={() => void handleDeleteTicket(ticket.id)}
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
          <section className="flex w-12 shrink-0 items-start pt-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Tilføj kolonne"
              onClick={() => void handleAddColumn(detail.columns.length)}
            >
              <Plus className="size-4" />
            </Button>
          </section>
        ) : null}
      </div>

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
        onAdded={() => void refreshBoard()}
      />

      <KanbanQuickCreateDialog
        open={quickCreateOpen}
        boardId={detail.board.id}
        columnId={targetColumnId}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={() => void refreshBoard()}
      />
    </div>
  );
}
