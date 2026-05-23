"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { KanbanCreateBoardDialog } from "@/components/kanban/kanban-create-board-dialog";
import { Button } from "@/components/ui/button";
import type { KanbanBoardSummary } from "@/types/kanban";

export function KanbanLanding({ boards }: { boards: KanbanBoardSummary[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="wire-scroll-content star-page flex min-h-0 flex-1 flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="star-page-title">Kanban</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Opret boards per team eller arbejdsområde. Træk sager mellem kolonner — status
            opdateres automatisk.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Nyt board
        </Button>
      </header>

      {boards.length === 0 ? (
        <section className="ledger-card flex flex-col items-center justify-center gap-3 p-10 text-center">
          <p className="text-muted-foreground text-sm">Du har endnu ingen Kanban-boards.</p>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Opret dit første board
          </Button>
        </section>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/kanban/${board.id}`}
                className="ledger-card hover:border-star-blue/40 block p-4 transition-colors"
              >
                <h2 className="font-semibold">{board.name}</h2>
                {board.team_name ? (
                  <p className="text-muted-foreground mt-1 text-xs">Gruppe: {board.team_name}</p>
                ) : (
                  <p className="text-muted-foreground mt-1 text-xs">Alle grupper</p>
                )}
                {board.description ? (
                  <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">
                    {board.description}
                  </p>
                ) : null}
              </Link>
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
    </div>
  );
}
