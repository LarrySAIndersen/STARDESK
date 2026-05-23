"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { KanbanBoardSettings } from "@/components/kanban/kanban-board-settings";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { KanbanCreateBoardDialog } from "@/components/kanban/kanban-create-board-dialog";
import { KanbanTicketDrawer } from "@/components/kanban/kanban-ticket-drawer";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPatch } from "@/lib/api";
import { canManageUsers } from "@/lib/auth";
import type { Category } from "@/types/category";
import type { KanbanBoardDetail, KanbanBoardSummary } from "@/types/kanban";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

function readDraggedTicketId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData("application/x-stardesk-kanban-ticket") ||
    dataTransfer.getData("text/plain") ||
    ""
  );
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
  const [moveError, setMoveError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="star-page-title truncate">{detail.board.name}</h1>
          {detail.board.team_name ? (
            <span className="text-muted-foreground text-xs">· {detail.board.team_name}</span>
          ) : (
            <span className="text-muted-foreground text-xs">· Alle grupper</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {moveError ? <p className="text-destructive px-1 text-sm">{moveError}</p> : null}

      {totalCards === 0 ? (
        <section className="ledger-card mx-1 flex flex-col items-center justify-center gap-2 p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Ingen åbne sager i dette board endnu.
            {detail.board.team_id
              ? " Tildel sager til den valgte gruppe, eller vælg et andet scope."
              : " Tildel sager til teams, eller opret nye sager."}
          </p>
          <Link
            href="/tickets/new"
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            Opret sag
          </Link>
        </section>
      ) : (
        <div
          className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4 px-1"
          role="list"
          aria-label="Kanban-kolonner"
        >
          {detail.columns.map(({ column, cards }) => (
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
                <h2 className="text-sm font-semibold">{column.name}</h2>
                <p className="text-muted-foreground text-[10px]">{cards.length} sager</p>
              </header>
              <div
                className={`flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto p-2 ${
                  dragOverColumnId === column.id ? "bg-star-blue/5 ring-1 ring-star-blue/30" : ""
                }`}
              >
                {cards.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    Træk sager hertil
                  </p>
                ) : (
                  cards.map(({ ticket }) => (
                    <KanbanCard
                      key={ticket.id}
                      ticket={ticket}
                      dragging={draggingTicketId === ticket.id}
                      onDragStart={() => setDraggingTicketId(ticket.id)}
                      onDragEnd={() => setDraggingTicketId(null)}
                      onOpen={() => {
                        setSelectedTicketId(ticket.id);
                        if (categories.length === 0) {
                          apiGet<Category[]>("/api/v1/categories").then(setCategories).catch(() => {});
                        }
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

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
    </div>
  );
}
