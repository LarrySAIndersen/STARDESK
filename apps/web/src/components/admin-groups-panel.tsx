"use client";

import { useCallback, useEffect, useId, useState, type ReactNode, type RefObject } from "react";

import { GroupsTeamSections } from "@/components/groups-team-sections";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiGet, apiPatch } from "@/lib/api";
import type { UserAdminListResponse } from "@/types/admin-user";
import type { Team } from "@/types/team";

function GroupMembersDialog({
  team,
  allUsers,
  onClose,
  onSaved,
}: {
  team: Team;
  allUsers: UserAdminListResponse["items"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleId = useId();
  const panelRef = useFocusTrap(true, onClose);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    team.members.map((m) => m.user_id),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleUser = (userId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...current, userId] : current.filter((id) => id !== userId),
    );
  };

  const onSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await apiPatch<Team>(`/api/v1/teams/${team.id}`, {
        user_ids: selectedIds,
      });
      onSaved();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kunne ikke gemme medlemmer");
    } finally {
      setSaving(false);
    }
  };

  const staffUsers = allUsers.filter(
    (u) => u.is_active && (u.role === "agent" || u.role === "admin" || u.role === "top_admin"),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <DialogPanel ref={panelRef} titleId={titleId} title={team.name} onClose={onClose}>
        <p className="text-muted-foreground mb-4 text-sm">
          Vælg sagsbehandlere der skal modtage sager i denne gruppe.
        </p>
        <div className="border-input max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
          {staffUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ingen aktive agenter fundet.</p>
          ) : (
            staffUsers.map((user) => (
              <label key={user.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={selectedIds.includes(user.id)}
                  onChange={(event) => toggleUser(user.id, event.target.checked)}
                />
                <span>
                  {user.display_name}{" "}
                  <span className="text-muted-foreground text-xs">({user.email})</span>
                </span>
              </label>
            ))
          )}
        </div>
        {saveError ? <p className="text-destructive mt-3 text-sm">{saveError}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuller
          </Button>
          <Button
            type="button"
            className="bg-star-blue hover:bg-star-navy"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? "Gemmer…" : "Gem medlemmer"}
          </Button>
        </div>
      </DialogPanel>
    </div>
  );
}

function DialogPanel({
  ref,
  titleId,
  title,
  onClose,
  children,
}: {
  ref: RefObject<HTMLDivElement | null>;
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="bg-background max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6 shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-star-navy text-lg font-semibold">
          {title}
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Luk">
          ✕
        </Button>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function AdminGroupsPanel({
  initialTeams,
  initialError,
}: {
  initialTeams: Team[];
  initialError: string | null;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [error, setError] = useState(initialError);
  const [allUsers, setAllUsers] = useState<UserAdminListResponse["items"]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const reloadTeams = useCallback(async () => {
    try {
      const fresh = await apiGet<Team[]>("/api/v1/teams");
      setTeams(fresh);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente grupper");
    }
  }, []);

  useEffect(() => {
    void reloadTeams();
  }, [reloadTeams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await apiGet<UserAdminListResponse>(
          "/api/v1/users?page_size=100",
        );
        if (!cancelled) {
          setAllUsers(response.items);
        }
      } catch {
        // list still works without user picker data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-destructive mt-6 text-sm">{error}</p>;
  }

  if (teams.length === 0) {
    return <p className="text-muted-foreground mt-6 text-sm">Ingen grupper fundet.</p>;
  }

  return (
    <>
      <GroupsTeamSections teams={teams} onEditMembers={setEditingTeam} />

      {editingTeam ? (
        <GroupMembersDialog
          team={editingTeam}
          allUsers={allUsers}
          onClose={() => setEditingTeam(null)}
          onSaved={() => void reloadTeams()}
        />
      ) : null}
    </>
  );
}
