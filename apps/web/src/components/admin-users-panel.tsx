"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminUserAddToTeamDialog } from "@/components/admin-user-add-to-team-dialog";
import { AdminUserCreateDialog } from "@/components/admin-user-create-dialog";
import { AdminUserEditDialog } from "@/components/admin-user-edit-dialog";
import { AdminUsersGroupedSections } from "@/components/admin-users-grouped-sections";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useListFilters } from "@/hooks/use-list-filters";
import {
  applyAdminUsersListFilters,
  DEFAULT_ADMIN_USERS_FILTERS,
  filterAdminUsers,
  type AdminUsersListFilters,
  type UsersTab,
} from "@/lib/admin-users-grouping";
import { apiGet, apiPatch } from "@/lib/api";
import type {
  UserAdminListItem,
  UserAdminListResponse,
  UserAdminMeta,
  UserAdminRead,
} from "@/types/admin-user";
import type { Team } from "@/types/team";
import type { UserRole } from "@/types/user";

async function fetchAllAdminUsers(search: string): Promise<UserAdminListItem[]> {
  const params = new URLSearchParams({ page: "1", page_size: "100" });
  if (search.trim()) {
    params.set("q", search.trim());
  }
  const first = await apiGet<UserAdminListResponse>(`/api/v1/users?${params}`);
  const items = [...first.items];
  const totalPages = Math.max(1, Math.ceil(first.total / first.page_size));
  for (let page = 2; page <= totalPages; page += 1) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("page", String(page));
    const next = await apiGet<UserAdminListResponse>(`/api/v1/users?${nextParams}`);
    items.push(...next.items);
  }
  return items;
}

export function AdminUsersPanel({ currentUserRole }: { currentUserRole: UserRole }) {
  const [query, setQuery] = useState("");
  const {
    search,
    setSearch,
    tab,
    setTab,
    filters,
    setFilters,
    reset: resetListFilters,
    hasActiveFilters,
  } = useListFilters<UsersTab, AdminUsersListFilters>({
    defaultTab: "all",
    defaultFilters: DEFAULT_ADMIN_USERS_FILTERS,
  });
  const [users, setUsers] = useState<UserAdminListItem[]>([]);
  const [meta, setMeta] = useState<UserAdminMeta | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [addingToTeamUser, setAddingToTeamUser] = useState<UserAdminListItem | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchAllAdminUsers(search);
      setUsers(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke hente brugere");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fireAndForget(loadList());
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [metaResponse, teamsResponse] = await Promise.all([
          apiGet<UserAdminMeta>("/api/v1/users/meta"),
          apiGet<Team[]>("/api/v1/teams"),
        ]);
        if (!cancelled) {
          setMeta(metaResponse);
          setTeams(teamsResponse);
        }
      } catch {
        if (!cancelled) {
          setError("Kunne ikke hente formular-data");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const searchFilteredUsers = useMemo(
    () => filterAdminUsers(users, search),
    [users, search],
  );
  const displayedUsers = useMemo(
    () => applyAdminUsersListFilters(searchFilteredUsers, teams, tab, filters),
    [searchFilteredUsers, teams, tab, filters],
  );

  const updateMembership = async (user: UserAdminListItem, teamIds: string[]) => {
    setMembershipBusy(true);
    setError(null);
    try {
      await apiPatch<UserAdminRead>(`/api/v1/users/${user.id}`, { team_ids: teamIds });
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opdatere gruppemedlemskab");
    } finally {
      setMembershipBusy(false);
    }
  };

  const onRemoveFromTeam = (user: UserAdminListItem, teamId: string) => {
    if (membershipBusy) {
      return;
    }
    fireAndForget(updateMembership(
      user,
      user.team_ids.filter((id) => id !== teamId),
    ));
  };

  return (
    <section className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-md flex-1 space-y-2">
          <Label htmlFor="user-search">Søg</Label>
          <div className="flex gap-2">
            <Input
              id="user-search"
              type="search"
              placeholder="Navn, e-mail eller gruppe…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSearch(query);
                }
              }}
              className="wire-search-input"
            />
            <Button
              type="button"
              className="bg-star-blue hover:bg-star-navy shrink-0"
              onClick={() => setSearch(query)}
            >
              Søg
            </Button>
            <ClearFiltersButton
              visible={hasActiveFilters || query.trim().length > 0}
              onClick={() => {
                setQuery("");
                resetListFilters();
              }}
            />
            <button
              type="button"
              className="wire-btn wire-btn-red shrink-0"
              onClick={() => setCreatingUser(true)}
              disabled={!meta}
            >
              + Opret bruger
            </button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          {loading
            ? "Henter…"
            : `${displayedUsers.length} af ${searchFilteredUsers.length} bruger${searchFilteredUsers.length === 1 ? "" : "e"}`}
          {!loading ? " · API henter op til 100 pr. side (alle sider ved søgning)" : null}
        </p>
      </div>

      {error ? <p className="text-destructive mt-4 text-sm">{error}</p> : null}

      {loading ? (
        <p className="text-muted-foreground mt-8 text-sm">Henter brugere…</p>
      ) : searchFilteredUsers.length === 0 ? (
        <p className="text-muted-foreground mt-8 text-sm">Ingen brugere fundet.</p>
      ) : (
        <AdminUsersGroupedSections
          users={displayedUsers}
          usersForTabCounts={searchFilteredUsers}
          teams={teams}
          roleOptions={meta?.roles ?? []}
          filters={filters}
          onFiltersChange={(patch) =>
            setFilters((prev) => ({ ...prev, ...patch }))
          }
          tab={tab}
          onTabChange={setTab}
          onEdit={setEditingUserId}
          onRemoveFromTeam={onRemoveFromTeam}
          onAddToTeam={setAddingToTeamUser}
        />
      )}

      {editingUserId && meta ? (
        <AdminUserEditDialog
          userId={editingUserId}
          meta={meta}
          teams={teams}
          currentUserRole={currentUserRole}
          onClose={() => setEditingUserId(null)}
          onSaved={() => fireAndForget(loadList())}
        />
      ) : null}

      {addingToTeamUser ? (
        <AdminUserAddToTeamDialog
          user={addingToTeamUser}
          teams={teams}
          onClose={() => setAddingToTeamUser(null)}
          onSaved={() => fireAndForget(loadList())}
        />
      ) : null}

      {creatingUser && meta ? (
        <AdminUserCreateDialog
          meta={meta}
          teams={teams}
          users={users}
          currentUserRole={currentUserRole}
          onClose={() => setCreatingUser(false)}
          onCreated={() => fireAndForget(loadList())}
        />
      ) : null}

    </section>
  );
}
