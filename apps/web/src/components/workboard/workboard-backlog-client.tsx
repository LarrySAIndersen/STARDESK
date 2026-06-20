"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPatch, apiPost } from "@/lib/api";
import { groupWorkboardTasks, type WorkboardColumnId } from "@/lib/workboard-columns";
import type { WorkboardTask, WorkboardTaskCreate } from "@/types/workboard";
import { cn } from "@/lib/utils";

const COLUMN_META: Record<
  WorkboardColumnId,
  { title: string; hint: string; empty: string }
> = {
  later: {
    title: "Til senere",
    hint: "Opgaver I vil huske — ikke i gang endnu.",
    empty: "Ingen opgaver i køen.",
  },
  active: {
    title: "I gang",
    hint: "Det der arbejdes på nu.",
    empty: "Ingen aktive opgaver.",
  },
  done: {
    title: "Færdig",
    hint: "Afsluttede opgaver med PR/reference i beskrivelsen.",
    empty: "Ingen færdige opgaver endnu.",
  },
};

type WorkboardBacklogClientProps = {
  initialTasks: WorkboardTask[];
};

export function WorkboardBacklogClient({ initialTasks }: WorkboardBacklogClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => groupWorkboardTasks(tasks), [tasks]);

  async function refreshTasks() {
    const response = await fetch("/api/proxy/v1/workboard/tasks", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Kunne ikke hente opgaver.");
    }
    const next = (await response.json()) as WorkboardTask[];
    setTasks(next);
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Titel er påkrævet.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const payload: WorkboardTaskCreate = {
        title: trimmed,
        description: description.trim(),
        status: "Backlog",
        source: "Web backlog",
      };
      const created = await apiPost<WorkboardTask>("/api/v1/workboard/tasks", payload);
      setTasks((prev) => [...prev, created].sort((a, b) => a.number - b.number));
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette opgave.");
    } finally {
      setCreating(false);
    }
  }

  async function moveTask(task: WorkboardTask, status: string) {
    setBusyId(task.id);
    setError(null);
    try {
      const updated = await apiPatch<WorkboardTask>(`/api/v1/workboard/tasks/${task.id}`, {
        status,
      });
      setTasks((prev) => prev.map((row) => (row.id === task.id ? updated : row)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opdatere opgave.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={createTask} className="wire-card space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="text-star-blue size-5" aria-hidden />
          <h2 className="text-star-navy text-sm font-semibold">Ny opgave til senere</h2>
        </div>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Kort titel"
          aria-label="Opgavetitel"
          disabled={creating}
        />
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Kontekst, link til PR, acceptkriterier…"
          rows={3}
          aria-label="Beskrivelse"
          disabled={creating}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={creating}>
            {creating ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="mr-1.5 size-4" aria-hidden />
            )}
            Tilføj til backlog
          </Button>
        </div>
      </form>

      {error ? (
        <p className="text-star-red text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(COLUMN_META) as WorkboardColumnId[]).map((columnId) => {
          const meta = COLUMN_META[columnId];
          const columnTasks = grouped[columnId];
          return (
            <section key={columnId} className="wire-card flex min-h-48 flex-col gap-3">
              <header>
                <h2 className="text-star-navy font-semibold">{meta.title}</h2>
                <p className="text-muted-foreground mt-1 text-xs">{meta.hint}</p>
                <p className="text-muted-foreground mt-2 text-xs">{columnTasks.length} opgave(r)</p>
              </header>
              {columnTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">{meta.empty}</p>
              ) : (
                <ul className="space-y-2">
                  {columnTasks.map((task) => (
                    <li
                      key={task.id}
                      className={cn(
                        "rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3",
                        busyId === task.id && "opacity-70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                            #{task.number}
                          </p>
                          <h3 className="text-star-navy text-sm font-semibold">{task.title}</h3>
                        </div>
                        {busyId === task.id ? (
                          <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                        ) : null}
                      </div>
                      {task.description ? (
                        <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs">
                          {task.description}
                        </p>
                      ) : null}
                      {task.tags ? (
                        <p className="text-muted-foreground mt-2 text-[10px]">{task.tags}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {columnId === "later" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busyId !== null}
                            onClick={() => moveTask(task, "In Progress")}
                          >
                            Start
                          </Button>
                        ) : null}
                        {columnId === "active" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId !== null}
                              onClick={() => moveTask(task, "Done")}
                            >
                              Færdig
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyId !== null}
                              onClick={() => moveTask(task, "Backlog")}
                            >
                              Tilbage
                            </Button>
                          </>
                        ) : null}
                        {columnId === "done" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId !== null}
                            onClick={() => moveTask(task, "Backlog")}
                          >
                            Genåbn
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Data gemmes i databasen (Neon). Markdown-kopi:{" "}
        <Link href="https://github.com/LarrySAIndersen/STARDESK/blob/staging/workboard/backlog.md" className="underline">
          workboard/backlog.md
        </Link>
        .{" "}
        <button
          type="button"
          className="underline"
          onClick={() => {
            void refreshTasks().catch(() => setError("Kunne ikke opdatere listen."));
          }}
        >
          Opdater liste
        </button>
      </p>
    </div>
  );
}
