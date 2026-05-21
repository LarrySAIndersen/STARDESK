"use client";

import { useMemo } from "react";

import { AdminUserCard } from "@/components/admin-user-card";
import { cn } from "@/lib/utils";
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
        {users.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-sm">
            Ingen brugere matcher filtrene.
          </p>
        ) : (
          <div className="admin-users-card-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {users.map((user) => (
              <AdminUserCard
                key={user.id}
                user={user}
                onEdit={onEdit}
                onRemoveFromTeam={onRemoveFromTeam}
                onAddToTeam={showAddToTeam ? onAddToTeam : undefined}
                removeTeamId={removeTeamId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
