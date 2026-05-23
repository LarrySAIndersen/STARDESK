"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPatch } from "@/lib/api";
import type { KanbanBoardDetail, KanbanBoardMember, KanbanMemberRole } from "@/types/kanban";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

const ROLE_LABELS: Record<KanbanMemberRole, string> = {
  owner: "Ejer",
  editor: "Redaktør",
  viewer: "Læser",
};

export function KanbanBoardSettings({
  detail,
  teams,
  users,
  onUpdated,
  onDeleted,
  onClose,
}: {
  detail: KanbanBoardDetail;
  teams: Team[];
  users: User[];
  onUpdated: (detail: KanbanBoardDetail) => void;
  onDeleted?: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(detail.board.name);
  const [teamId, setTeamId] = useState(detail.board.team_id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(
    () => detail.members.map((m) => m.user_id),
  );
  const [roles, setRoles] = useState<Record<string, KanbanMemberRole>>(() =>
    Object.fromEntries(detail.members.map((m) => [m.user_id, m.role])),
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return users.slice(0, 30);
    }
    return users
      .filter(
        (u) =>
          u.display_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [users, search]);

  function toggleMember(userId: string) {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
    if (!roles[userId]) {
      setRoles((prev) => ({ ...prev, [userId]: "editor" }));
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Slet boardet "${detail.board.name}"? Dette kan ikke fortrydes.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await apiDelete(`/api/v1/kanban/boards/${detail.board.id}`);
      if (onDeleted) {
        onDeleted();
      } else {
        router.push("/kanban");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke slette board.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const members: KanbanBoardMember[] = memberIds.map((userId) => {
      const user = users.find((u) => u.id === userId);
      return {
        user_id: userId,
        display_name: user?.display_name ?? userId,
        role: roles[userId] ?? "editor",
      };
    });
    try {
      await apiPatch(`/api/v1/kanban/boards/${detail.board.id}`, {
        name: name.trim(),
        team_id: teamId || null,
        members: members.map((m) => ({ user_id: m.user_id, role: m.role })),
      });
      const refreshed = await apiGet<KanbanBoardDetail>(
        `/api/v1/kanban/boards/${detail.board.id}`,
      );
      onUpdated(refreshed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ledger-card space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="star-section-title">Board-indstillinger</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Luk
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="kanban-settings-name">Navn</Label>
        <Input
          id="kanban-settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Gruppe (filter ved tilføjelse)</Label>
        <Select
          value={teamId || "__none__"}
          onValueChange={(v) => setTeamId(!v || v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Alle grupper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Alle grupper</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="kanban-member-search">Adgang — brugere</Label>
        <Input
          id="kanban-member-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg bruger…"
        />
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-[var(--gray-border)] p-2">
          {filteredUsers.map((user) => {
            const selected = memberIds.includes(user.id);
            return (
              <li key={user.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleMember(user.id)}
                  id={`kanban-member-${user.id}`}
                />
                <label htmlFor={`kanban-member-${user.id}`} className="min-w-0 flex-1 truncate">
                  {user.display_name}
                </label>
                {selected ? (
                  <select
                    className="rounded border border-[var(--gray-border)] bg-background px-1 py-0.5 text-xs"
                    value={roles[user.id] ?? "editor"}
                    onChange={(e) =>
                      setRoles((prev) => ({
                        ...prev,
                        [user.id]: e.target.value as KanbanMemberRole,
                      }))
                    }
                    aria-label={`Rolle for ${user.display_name}`}
                  >
                    {(Object.keys(ROLE_LABELS) as KanbanMemberRole[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {users.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Kun administratorer kan tilføje brugere via brugerlisten. Eksisterende medlemmer vises
          på boardet.
        </p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Gemmer…" : "Gem indstillinger"}
        </Button>
        {detail.can_delete_board ? (
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? "Sletter…" : "Slet board"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
