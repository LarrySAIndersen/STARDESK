"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useId, useState } from "react";

import {
  AdminUserDialogPanel,
  AdminUserModalBackdrop,
  adminUserSelectClassName,
} from "@/components/admin-user-dialog-panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPatch } from "@/lib/api";
import type { UserAdminListItem, UserAdminRead } from "@/types/admin-user";
import type { Team } from "@/types/team";

export function AdminUserAddToTeamDialog({
  user,
  teams,
  onClose,
  onSaved,
}: {
  user: UserAdminListItem;
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleId = useId();
  const panelRef = useFocusTrap(true, onClose);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableTeams = teams.filter((team) => !user.team_ids.includes(team.id));

  const onSave = async () => {
    if (!selectedTeamId) {
      setError("Vælg en gruppe");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiPatch<UserAdminRead>(`/api/v1/users/${user.id}`, {
        team_ids: [...user.team_ids, selectedTeamId],
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tilføje til gruppe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminUserModalBackdrop onClose={onClose}>
      <AdminUserDialogPanel
        ref={panelRef}
        titleId={titleId}
        title={`Tilføj ${user.display_name} til gruppe`}
        onClose={onClose}
      >
        {availableTeams.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brugeren er allerede medlem af alle grupper.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-team-select">Gruppe</Label>
              <select
                id="add-team-select"
                className={adminUserSelectClassName}
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                <option value="">Vælg gruppe…</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuller
              </Button>
              <Button
                type="button"
                className="bg-star-blue hover:bg-star-navy"
                disabled={saving}
                onClick={() => fireAndForget(onSave())}
              >
                {saving ? "Gemmer…" : "Tilføj"}
              </Button>
            </div>
          </div>
        )}
      </AdminUserDialogPanel>
    </AdminUserModalBackdrop>
  );
}
