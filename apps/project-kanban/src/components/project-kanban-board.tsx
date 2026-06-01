"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { LogOut, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { PkCard, PkColumnWithCards } from "@/lib/db";
import { cn } from "@/lib/utils";

const COLUMN_COLORS = [
  "border-t-blue-500",
  "border-t-amber-500",
  "border-t-violet-500",
  "border-t-emerald-500",
  "border-t-rose-500",
];

function readDraggedId(dataTransfer: DataTransfer): string {
  return dataTransfer.getData("application/x-pk-card") || dataTransfer.getData("text/plain") || "";
}

export function ProjectKanbanBoard() {
  const router = useRouter();
  const [columns, setColumns] = useState<PkColumnWithCards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/board");
      if (!response.ok) {
        throw new Error("Kunne ikke hente board");
      }
      setColumns((await response.json()) as PkColumnWithCards[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fejl");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fireAndForget(refresh());
  }, [refresh]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleDrop(columnId: string, event: React.DragEvent) {
    event.preventDefault();
    setDragOverColumnId(null);
    const cardId = readDraggedId(event.dataTransfer);
    setDraggingId(null);
    if (!cardId) return;

    const previous = columns;
    setColumns((current) => moveCardOptimistic(current, cardId, columnId));

    try {
      const response = await fetch(`/api/cards/${cardId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column_id: columnId }),
      });
      if (!response.ok) throw new Error("Kunne ikke flytte kort");
      await refresh();
    } catch (err) {
      setColumns(previous);
      setError(err instanceof Error ? err.message : "Flyt fejlede");
    }
  }

  async function handleAddCard(columnId: string) {
    const title = newCardTitle.trim();
    if (!title) return;
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, column_id: columnId }),
      });
      if (!response.ok) throw new Error("Kunne ikke oprette kort");
      setNewCardTitle("");
      setNewCardColumnId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opret fejlede");
    }
  }

  async function handleAddColumn() {
    const name = window.prompt("Navn på ny kolonne:");
    if (!name?.trim()) return;
    try {
      const response = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error("Kunne ikke oprette kolonne");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kolonne fejlede");
    }
  }

  async function handleDeleteCard(cardId: string) {
    if (!window.confirm("Slet dette kort?")) return;
    try {
      await fetch(`/api/cards?id=${encodeURIComponent(cardId)}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slet fejlede");
    }
  }

  if (loading) {
    return <p className="p-8 text-[var(--muted)]">Indlæser board…</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">STARDESK Projekt Backlog</h1>
          <p className="text-xs text-[var(--muted)]">
            Uafhængigt board · data i separat database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fireAndForget(refresh())}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--accent-soft)]"
          >
            <RefreshCw className="size-3.5" />
            Opdater
          </button>
          <button
            type="button"
            onClick={() => fireAndForget(handleLogout())}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--accent-soft)]"
          >
            <LogOut className="size-3.5" />
            Log ud
          </button>
        </div>
      </header>

      {error ? <p className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {columns.map(({ column, cards }, index) => {
          const isDrop = dragOverColumnId === column.id;
          return (
            <section
              key={column.id}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border border-[var(--border)] border-t-[3px] bg-[var(--card)] shadow-sm",
                COLUMN_COLORS[index % COLUMN_COLORS.length],
                isDrop && "ring-2 ring-[var(--accent)]/40",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverColumnId(column.id);
              }}
              onDragLeave={() => {
                if (dragOverColumnId === column.id) setDragOverColumnId(null);
              }}
              onDrop={(e) => fireAndForget(handleDrop(column.id, e))}
            >
              <header className="border-b border-[var(--border)] px-3 py-2.5">
                <h2 className="text-sm font-semibold">{column.name}</h2>
                <p className="text-[10px] text-[var(--muted)]">{cards.length} opgaver</p>
              </header>
              <div
                className={cn(
                  "flex max-h-[calc(100dvh-10rem)] min-h-48 flex-1 flex-col gap-2 overflow-y-auto p-2",
                  isDrop && "bg-[var(--accent-soft)]",
                )}
              >
                {isDrop ? (
                  <p className="rounded border border-dashed border-[var(--accent)]/40 py-3 text-center text-xs text-[var(--accent)]">
                    Slip her
                  </p>
                ) : null}
                {cards.map((card) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    dragging={draggingId === card.id}
                    onDragStart={() => setDraggingId(card.id)}
                    onDragEnd={() => setDraggingId(null)}
                    onDelete={() => fireAndForget(handleDeleteCard(card.id))}
                  />
                ))}
                {newCardColumnId === column.id ? (
                  <div className="space-y-2 rounded-md border border-[var(--border)] p-2">
                    <input
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="Titel på opgave…"
                      className="w-full rounded border border-[var(--border)] px-2 py-1 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") fireAndForget(handleAddCard(column.id));
                        if (e.key === "Escape") {
                          setNewCardColumnId(null);
                          setNewCardTitle("");
                        }
                      }}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="flex-1 rounded bg-[var(--accent)] px-2 py-1 text-xs text-white"
                        onClick={() => fireAndForget(handleAddCard(column.id))}
                      >
                        Tilføj
                      </button>
                      <button
                        type="button"
                        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                        onClick={() => {
                          setNewCardColumnId(null);
                          setNewCardTitle("");
                        }}
                      >
                        Annuller
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-auto rounded-md py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
                    onClick={() => setNewCardColumnId(column.id)}
                  >
                    + Ny opgave
                  </button>
                )}
              </div>
            </section>
          );
        })}
        <button
          type="button"
          onClick={() => fireAndForget(handleAddColumn())}
          className="flex h-10 w-44 shrink-0 items-center justify-center gap-1 self-start rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
        >
          <Plus className="size-4" />
          Ny kolonne
        </button>
      </div>
    </div>
  );
}

function CardItem({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  card: PkCard;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const [didDrag, setDidDrag] = useState(false);

  return (
    <article
      draggable
      className={cn(
        "group cursor-grab rounded-lg border border-[var(--border)] bg-white p-2.5 shadow-sm active:cursor-grabbing",
        dragging && "opacity-60 ring-2 ring-[var(--accent)]/40",
      )}
      onDragStart={(e) => {
        setDidDrag(true);
        e.dataTransfer.setData("application/x-pk-card", card.id);
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => setDidDrag(false), 0);
      }}
      onDoubleClick={() => {
        if (didDrag) return;
        const next = window.prompt("Rediger titel:", card.title);
        if (next?.trim() && next.trim() !== card.title) {
          fireAndForget(fetch("/api/cards", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: card.id, title: next.trim() }),
          }).then(() => window.location.reload()));
        }
      }}
    >
      <p className="line-clamp-4 text-sm leading-snug">{card.title}</p>
      <button
        type="button"
        className="mt-2 hidden text-[10px] text-red-600 group-hover:inline"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        Slet
      </button>
    </article>
  );
}

function moveCardOptimistic(
  columns: PkColumnWithCards[],
  cardId: string,
  targetColumnId: string,
): PkColumnWithCards[] {
  let moved: PkCard | null = null;
  const stripped = columns.map(({ column, cards }) => {
    const remaining = cards.filter((c) => {
      if (c.id === cardId) {
        moved = c;
        return false;
      }
      return true;
    });
    return { column, cards: remaining };
  });
  if (!moved) return columns;
  return stripped.map(({ column, cards }) =>
    column.id === targetColumnId
      ? { column, cards: [...cards, { ...moved!, position: cards.length }] }
      : { column, cards },
  );
}
