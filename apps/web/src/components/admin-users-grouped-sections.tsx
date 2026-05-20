"use client";

import { Pencil, UserMinus, UserPlus } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn, displayNameInitials } from "@/lib/utils";
import {
  ADMIN_USERS_NO_TEAM_FILTER,
  type AdminUsersListFilters,
} from "@/lib/admin-users-grouping";
import type { UsersTab } from "@/lib/admin-users-grouping";
import { countUsersByTab } from "@/lib/admin-users-grouping";
import type { UserAdminListItem } from "@/types/admin-user";
import type { RoleOption } from "@/types/admin-user";
import type { Team } from "@/types/team";

export type { UsersTab };

const TAB_LABELS: { id: UsersTab; label: string }[] = [
  { id: "internal", label: "Interne" },
  { id: "external", label: "Eksterne" },
  { id: "all", label: "Alle" },
];

function AdminUsersTableHead() {
  return (
    <div className="wire-table-head wire-table-grid-admin-users" role="row">
      <span>Navn</span>
      <span>E-mail</span>
      <span>Rolle</span>
      <span>Gruppe(r)</span>
      <span>Status</span>
      <span className="text-right">Handlinger</span>
    </div>
  );
}

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return <span className="wire-badge wire-badge--resolved">Aktiv</span>;
  }
  return <span className="wire-badge wire-badge--critical">Inaktiv</span>;
}

function AdminUserTableRow({
  user,
  onEdit,
  onRemoveFromTeam,
  onAddToTeam,
  removeTeamId,
}: {
  user: UserAdminListItem;
  onEdit: (userId: string) => void;
  onRemoveFromTeam?: (user: UserAdminListItem, teamId: string) => void;
  onAddToTeam?: (user: UserAdminListItem) => void;
  removeTeamId?: string;
}) {
  const initials = displayNameInitials(user.display_name);
  const groupsLabel =
    user.team_names.length > 0 ? user.team_names.join(", ") : "—";

  return (
    <div
      role="row"
      className="wire-table-row wire-table-row--compact wire-table-grid-admin-users items-center"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="wire-avatar-xs" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0">
          <button
            type="button"
            className="text-star-navy hover:text-star-blue truncate text-left text-xs font-medium leading-tight underline-offset-2 hover:underline"
            onClick={() => onEdit(user.id)}
          >
            {user.display_name}
          </button>
          <button
            type="button"
            className="text-star-blue hover:text-star-navy block text-[10px] underline underline-offset-2"
            onClick={() => onEdit(user.id)}
          >
            se mere
          </button>
        </div>
      </div>

      <span className="text-muted-foreground truncate" title={user.email}>
        {user.email}
      </span>

      <span className="truncate" title={user.role_label}>
        {user.role_label}
      </span>

      <span className="truncate" title={groupsLabel}>
        {groupsLabel}
      </span>

      <span>
        <UserStatusBadge isActive={user.is_active} />
      </span>

      <div className="flex items-center justify-end gap-0.5">
        {onAddToTeam ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-star-navy size-7"
            aria-label={`Tilføj ${user.display_name} til gruppe`}
            title="Tilføj til gruppe"
            onClick={() => onAddToTeam(user)}
          >
            <UserPlus className="size-3.5" />
          </Button>
        ) : null}
        {onRemoveFromTeam && removeTeamId && user.team_ids.includes(removeTeamId) ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-7"
            aria-label={`Fjern ${user.display_name} fra gruppe`}
            title="Fjern fra gruppe"
            onClick={() => onRemoveFromTeam(user, removeTeamId)}
          >
            <UserMinus className="size-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-star-navy size-7"
          aria-label={`Rediger ${user.display_name}`}
          title="Rediger"
          onClick={() => onEdit(user.id)}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function AdminUsersGroupedSections({
  users,
  usersForTabCounts,
  teams,
  roleOptions,
  filters,
  onFiltersChange,
  onEdit,
  onRemoveFromTeam,
  onAddToTeam,
  tab,
  onTabChange,
}: {
  users: UserAdminListItem[];
  usersForTabCounts: UserAdminListItem[];
  teams: Team[];
  roleOptions: RoleOption[];
  filters: AdminUsersListFilters;
  onFiltersChange: (patch: Partial<AdminUsersListFilters>) => void;
  onEdit: (userId: string) => void;
  onRemoveFromTeam: (user: UserAdminListItem, teamId: string) => void;
  onAddToTeam: (user: UserAdminListItem) => void;
  tab: UsersTab;
  onTabChange: (tab: UsersTab) => void;
}) {
  const tabCounts = useMemo(
    () => countUsersByTab(usersForTabCounts, teams),
    [usersForTabCounts, teams],
  );

  const removeTeamId =
    filters.teamId && filters.teamId !== ADMIN_USERS_NO_TEAM_FILTER
      ? filters.teamId
      : undefined;

  const showAddToTeam =
    filters.teamId === ADMIN_USERS_NO_TEAM_FILTER || tab === "all";

  return (
    <div className="mt-6 space-y-4">
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Filtrer brugere efter gruppekategori"
      >
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn("wire-btn wire-btn-sm", tab === id && "wire-btn-primary")}
            onClick={() => onTabChange(id)}
          >
            {label}
            <span className="ml-1.5 font-normal tabular-nums opacity-80">
              ({tabCounts[id]})
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 max-sm:[&_select]:min-w-[calc(50%-0.25rem)] max-sm:[&_select]:flex-1">
        <select
          className="wire-form-input h-8 w-auto min-w-[8.5rem] text-xs"
          value={filters.role}
          onChange={(event) => onFiltersChange({ role: event.target.value })}
          aria-label="Filtrer rolle"
        >
          <option value="">Alle roller</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[9rem] text-xs"
          value={filters.teamId}
          onChange={(event) => onFiltersChange({ teamId: event.target.value })}
          aria-label="Filtrer gruppe"
        >
          <option value="">Alle grupper</option>
          <option value={ADMIN_USERS_NO_TEAM_FILTER}>Uden gruppe</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[7.5rem] text-xs"
          value={filters.status}
          onChange={(event) => onFiltersChange({ status: event.target.value })}
          aria-label="Filtrer status"
        >
          <option value="">Alle status</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Inaktiv</option>
        </select>
        <select
          className="wire-form-input h-8 w-auto min-w-[8rem] text-xs"
          value={filters.sort}
          onChange={(event) => onFiltersChange({ sort: event.target.value })}
          aria-label="Sorter brugere"
        >
          <option value="name_asc">Navn (A–Å)</option>
          <option value="name_desc">Navn (Å–A)</option>
          <option value="email">E-mail</option>
          <option value="role">Rolle</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div role="tabpanel">
        <div className="overflow-x-auto">
          <div className="wire-table-wrap min-w-0 overflow-x-auto">
            <div className="wire-table-scroll min-w-[40rem]">
              <AdminUsersTableHead />
              {users.length === 0 ? (
                <p className="text-muted-foreground px-3.5 py-4 text-sm">
                  Ingen brugere matcher filtrene.
                </p>
              ) : (
                users.map((user) => (
                  <AdminUserTableRow
                    key={user.id}
                    user={user}
                    onEdit={onEdit}
                    onRemoveFromTeam={onRemoveFromTeam}
                    onAddToTeam={showAddToTeam ? onAddToTeam : undefined}
                    removeTeamId={removeTeamId}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
