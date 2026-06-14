"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { Category } from "@/types/category";
import type { Team } from "@/types/team";

type ScheduleUnit = "minute" | "hour" | "day" | "week" | "month";

type RecurringTaskRow = Readonly<{
  id: string;
  title: string;
  description: string;
  priority: string;
  category_id: string | null;
  subcategory_id: string | null;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  schedule_unit: ScheduleUnit;
  schedule_interval: number;
  schedule_label_da: string;
  next_run_at: string;
  last_run_at: string | null;
  last_ticket_id: string | null;
  last_ticket_number: string | null;
  is_active: boolean;
  created_at: string;
}>;

type FormState = {
  title: string;
  description: string;
  priority: string;
  category_id: string;
  subcategory_id: string;
  assigned_team_id: string;
  schedule_unit: ScheduleUnit;
  schedule_interval: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  priority: "medium",
  category_id: "",
  subcategory_id: "",
  assigned_team_id: "",
  schedule_unit: "day",
  schedule_interval: "1",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("da-DK", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function RecurringTasksPanel({
  teams,
  categories,
}: {
  teams: Team[];
  categories: Category[];
}) {
  const [tasks, setTasks] = useState<RecurringTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiGet<RecurringTaskRow[]>("/api/v1/recurring-tasks");
      setTasks(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente opgaver");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const selectedCategory = categories.find((c) => c.id === form.category_id);
  const subcategories = selectedCategory?.subcategories ?? [];

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const interval = Number.parseInt(form.schedule_interval, 10);
      if (!Number.isFinite(interval) || interval < 1) {
        setError("Angiv et gyldigt interval (mindst 1)");
        return;
      }
      if (!form.assigned_team_id) {
        setError("Vælg en ansvarlig gruppe");
        return;
      }
      await apiPost("/api/v1/recurring-tasks", {
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        assigned_team_id: form.assigned_team_id,
        schedule_unit: form.schedule_unit,
        schedule_interval: interval,
        is_active: true,
      });
      setMessage("Gentagen opgave oprettet");
      setForm(emptyForm);
      setShowForm(false);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke oprette opgave");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(task: RecurringTaskRow) {
    setError(null);
    try {
      await apiPatch(`/api/v1/recurring-tasks/${task.id}`, { is_active: !task.is_active });
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opdatere opgave");
    }
  }

  async function removeTask(task: RecurringTaskRow) {
    if (!window.confirm(`Slet gentagen opgave «${task.title}»?`)) {
      return;
    }
    setError(null);
    try {
      await apiDelete(`/api/v1/recurring-tasks/${task.id}`);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slette opgave");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">
          Gentagne opgaver (sagstype <strong>Wreck ind</strong>) opretter automatisk almindelige
          sager efter den valgte frekvens. Sager kan dirigeres til en gruppe.
        </p>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Annuller" : "Ny gentagen opgave"}
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="border-border space-y-4 rounded-lg border bg-white p-4 shadow-sm"
        >
          <h2 className="text-star-navy text-lg font-semibold">Ny gentagen opgave</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rt-title">Titel</Label>
              <Input
                id="rt-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                minLength={3}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rt-description">Beskrivelse</Label>
              <Textarea
                id="rt-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
                minLength={10}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-priority">Prioritet</Label>
              <select
                id="rt-priority"
                className="wire-form-input h-9 w-full"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Lav</option>
                <option value="medium">Medium</option>
                <option value="high">Høj</option>
                <option value="critical">Kritisk</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-team">Ansvarlig gruppe</Label>
              <select
                id="rt-team"
                className="wire-form-input h-9 w-full"
                value={form.assigned_team_id}
                onChange={(e) => setForm((f) => ({ ...f, assigned_team_id: e.target.value }))}
                required
              >
                <option value="">Vælg gruppe…</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-category">Kategori</Label>
              <select
                id="rt-category"
                className="wire-form-input h-9 w-full"
                value={form.category_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    category_id: e.target.value,
                    subcategory_id: "",
                  }))
                }
              >
                <option value="">Ingen</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name_da}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-subcategory">Underkategori</Label>
              <select
                id="rt-subcategory"
                className="wire-form-input h-9 w-full"
                value={form.subcategory_id}
                onChange={(e) => setForm((f) => ({ ...f, subcategory_id: e.target.value }))}
                disabled={!form.category_id}
              >
                <option value="">Ingen</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name_da}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-interval">Interval</Label>
              <Input
                id="rt-interval"
                type="number"
                min={1}
                max={10000}
                value={form.schedule_interval}
                onChange={(e) => setForm((f) => ({ ...f, schedule_interval: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-unit">Frekvens</Label>
              <select
                id="rt-unit"
                className="wire-form-input h-9 w-full"
                value={form.schedule_unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, schedule_unit: e.target.value as ScheduleUnit }))
                }
              >
                <option value="minute">Minut</option>
                <option value="hour">Time</option>
                <option value="day">Dag</option>
                <option value="week">Uge</option>
                <option value="month">Måned</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Gemmer…" : "Opret gentagen opgave"}
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Henter opgaver…</p>
      ) : tasks.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen gentagne opgaver endnu.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Frekvens</th>
                <th className="px-3 py-2 font-medium">Gruppe</th>
                <th className="px-3 py-2 font-medium">Næste kørsel</th>
                <th className="px-3 py-2 font-medium">Sidste sag</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-muted-foreground text-xs">Wreck ind</div>
                  </td>
                  <td className="px-3 py-2">{task.schedule_label_da}</td>
                  <td className="px-3 py-2">{task.assigned_team_name ?? "—"}</td>
                  <td className="px-3 py-2">{formatDateTime(task.next_run_at)}</td>
                  <td className="px-3 py-2">
                    {task.last_ticket_number ? (
                      <a
                        href={`/tickets/${task.last_ticket_id}`}
                        className="text-star-navy underline"
                      >
                        {task.last_ticket_number}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{task.is_active ? "Aktiv" : "Pauseret"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleActive(task)}
                      >
                        {task.is_active ? "Pause" : "Aktivér"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void removeTask(task)}
                      >
                        Slet
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
