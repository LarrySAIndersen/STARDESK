"use client";

import Link from "next/link";
import { Archive, Columns3, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { KanbanCloseBoardDialog } from "@/components/kanban/kanban-close-board-dialog";
import { KanbanCreateBoardDialog } from "@/components/kanban/kanban-create-board-dialog";
import { Button } from "@/components/ui/button";
import type { KanbanBoardSummary } from "@/types/kanban";

function canCloseBoard(board: KanbanBoardSummary): boolean {
  return board.my_role === "owner";
}

export function KanbanLanding({ boards: initialBoards }: { boards: KanbanBoardSummary[] }) {
  const router = useRouter();
  const [boards, setBoards] = useState(initialBoards);
  const [createOpen, setCreateOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState<KanbanBoardSummary | null>(null);

  function handleBoardClosed(boardId: string) {
    setBoards((prev) => prev.filter((board) => board.id !== boardId));
    setCloseTarget(null);
  }

  return (
    <div className="wire-scroll-content star-page flex min-h-0 flex-1 flex-col gap-6">
      <Link
        href="/projekter"
        className="text-[var(--gray-mid)] hover:text-star-navy inline-flex items-center gap-1 text-xs font-medium"
      >
        ← Tilbage til projektoversigt
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="star-page-title">Kanban</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Opret boards med kolonner der passer til dit arbejde. Træk sager mellem kolonner —
            status opdateres automatisk på ITSM-boards.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          Nyt board
        </Button>
      </header>

      {boards.length === 0 ? (
        <section className="ledger-card flex flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-star-blue/10 text-star-blue flex size-14 items-center justify-center rounded-2xl">
            <Columns3 className="size-7" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Kom i gang med Kanban</h2>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              Opret dit første board, vælg en skabelon (ITSM, simpel eller tilpasset), og tilføj
              kolonner med egne titler.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Opret dit første board
          </Button>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id} className="group relative">
              <Link
                href={`/kanban/${board.id}`}
                className="ledger-card hover:border-star-blue/40 block p-4 pr-12 transition-all hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="bg-muted text-muted-foreground group-hover:bg-star-blue/10 group-hover:text-star-blue flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
                    <Columns3 className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{board.name}</h2>
                    {board.team_name ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">Gruppe: {board.team_name}</p>
                    ) : (
                      <p className="text-muted-foreground mt-0.5 text-xs">Alle grupper</p>
                    )}
                    {board.description ? (
                      <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                        {board.description}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-sm">Åbn board →</p>
                    )}
                  </div>
                </div>
              </Link>
              {canCloseBoard(board) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive absolute right-2 top-2 size-8 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Luk board ${board.name}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setCloseTarget(board);
                  }}
                >
                  <Archive className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <KanbanCreateBoardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(boardId) => {
          setCreateOpen(false);
          router.push(`/kanban/${boardId}`);
        }}
      />

      {closeTarget ? (
        <KanbanCloseBoardDialog
          open
          boardId={closeTarget.id}
          boardName={closeTarget.name}
          onClose={() => setCloseTarget(null)}
          onClosed={() => handleBoardClosed(closeTarget.id)}
        />
      ) : null}
    </div>
  );
}
