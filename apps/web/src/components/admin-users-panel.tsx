"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AdminUserCreateDialog } from "@/components/admin-user-create-dialog";
import { AdminUserImportDialog } from "@/components/admin-user-import-dialog";
import { AdminUsersGroupedSections } from "@/components/admin-users-grouped-sections";
import { ClearFiltersButton } from "@/components/clear-filters-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useListFilters } from "@/hooks/use-list-filters";
import {
  applyAdminUsersListFilters,
  DEFAULT_ADMIN_USERS_FILTERS,
  filterAdminUsers,
  type AdminUsersListFilters,
  type UsersTab,
} from "@/lib/admin-users-grouping";
import { apiGet, apiPatch, apiPostNoContent } from "@/lib/api";
import type {
  UserAdminListItem,
  UserAdminListResponse,
  UserAdminMeta,
  UserAdminRead,
  UserAdminUpdateInput,
} from "@/types/admin-user";
import type { Team } from "@/types/team";
import type { UserRole } from "@/types/user";

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const profileSchema = z.object({
  display_name: z.string().min(1, "Navn er påkrævet"),
  email: z.string().email("Ugyldig e-mail"),
  role: z.enum(["end_user", "agent", "admin", "top_admin"]),
  is_active: z.boolean(),
  organization_id: z.string(),
  team_ids: z.array(z.string()),
});

const passwordSchema = z
  .object({
    new_password: z.string().min(8, "Mindst 8 tegn"),
    confirm_password: z.string().min(8, "Mindst 8 tegn"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Adgangskoderne matcher ikke",
    path: ["confirm_password"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

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

function AddToTeamDialog({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <UserEditDialogPanel
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
                className={selectClassName}
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
                onClick={() => void onSave()}
              >
                {saving ? "Gemmer…" : "Tilføj"}
              </Button>
            </div>
          </div>
        )}
      </UserEditDialogPanel>
    </div>
  );
}

function AdminUserEditDialog({
  userId,
  meta,
  teams,
  currentUserRole,
  onClose,
  onSaved,
}: {
  userId: string;
  meta: UserAdminMeta;
  teams: Team[];
  currentUserRole: UserRole;
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleId = useId();
  const panelRef = useFocusTrap(true, onClose);
  const [user, setUser] = useState<UserAdminRead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const roleOptions = useMemo(
    () =>
      meta.roles.filter(
        (role) => currentUserRole === "top_admin" || role.value !== "top_admin",
      ),
    [currentUserRole, meta.roles],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  const selectedTeamIds = watch("team_ids") ?? [];

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await apiGet<UserAdminRead>(`/api/v1/users/${userId}`);
        if (cancelled) {
          return;
        }
        setUser(detail);
        reset({
          display_name: detail.display_name,
          email: detail.email,
          role: detail.role as ProfileFormValues["role"],
          is_active: detail.is_active,
          organization_id: detail.organization_id ?? "",
          team_ids: detail.teams.map((t) => t.id),
        });
      } catch {
        if (!cancelled) {
          setLoadError("Kunne ikke hente bruger");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reset, userId]);

  const onSubmitProfile = handleSubmit(async (values) => {
    setSaveError(null);
    setSaving(true);
    try {
      const payload: UserAdminUpdateInput = {
        display_name: values.display_name.trim(),
        email: values.email.trim().toLowerCase(),
        role: values.role,
        is_active: values.is_active,
        organization_id: values.organization_id ? values.organization_id : null,
        team_ids: values.team_ids,
      };
      await apiPatch<UserAdminRead>(`/api/v1/users/${userId}`, payload);
      onSaved();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  });

  const onSubmitPassword = handlePasswordSubmit(async (values) => {
    setPasswordError(null);
    setPasswordSuccess(false);
    setResettingPassword(true);
    try {
      await apiPostNoContent(`/api/v1/users/${userId}/reset-password`, {
        new_password: values.new_password,
      });
      setPasswordSuccess(true);
      resetPasswordForm();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Kunne ikke skifte adgangskode");
    } finally {
      setResettingPassword(false);
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <UserEditDialogPanel ref={panelRef} titleId={titleId} title={user?.display_name ?? "Bruger"} onClose={onClose}>
        {loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
        ) : !user ? (
          <p className="text-muted-foreground text-sm">Henter bruger…</p>
        ) : (
          <>
            <form className="space-y-4" onSubmit={onSubmitProfile} noValidate>
              <h3 className="text-star-navy text-sm font-semibold">Profil</h3>
              <div className="space-y-2">
                <Label htmlFor="admin-user-name">Navn</Label>
                <Input id="admin-user-name" {...register("display_name")} />
                {errors.display_name ? (
                  <p className="text-destructive text-xs">{errors.display_name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-user-email">E-mail</Label>
                <Input id="admin-user-email" type="email" autoComplete="off" {...register("email")} />
                {errors.email ? (
                  <p className="text-destructive text-xs">{errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-user-role">Rettighedsgruppe</Label>
                <select id="admin-user-role" className={selectClassName} {...register("role")}>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-user-org">Organisation</Label>
                <select id="admin-user-org" className={selectClassName} {...register("organization_id")}>
                  <option value="">Ingen</option>
                  {meta.organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Grupper (dispatch)</Label>
                <div className="border-input max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                  {teams.map((team) => (
                    <label key={team.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border"
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...selectedTeamIds, team.id]
                            : selectedTeamIds.filter((id) => id !== team.id);
                          setValue("team_ids", next, { shouldDirty: true });
                        }}
                      />
                      {team.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="admin-user-active"
                  type="checkbox"
                  className="size-4 rounded border"
                  {...register("is_active")}
                />
                <Label htmlFor="admin-user-active" className="font-normal">
                  Aktiv konto
                </Label>
              </div>

              {saveError ? <p className="text-destructive text-sm">{saveError}</p> : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuller
                </Button>
                <Button type="submit" className="bg-star-blue hover:bg-star-navy" disabled={saving}>
                  {saving ? "Gemmer…" : "Gem profil"}
                </Button>
              </div>
            </form>

            <form className="mt-8 space-y-4 border-t pt-6" onSubmit={onSubmitPassword} noValidate>
              <h3 className="text-star-navy text-sm font-semibold">Ny adgangskode</h3>
              <p className="text-muted-foreground text-xs">
                Administrator sætter en ny adgangskode direkte — brugeren behøver ikke den gamle.
              </p>
              <div className="space-y-2">
                <Label htmlFor="admin-user-password">Ny adgangskode</Label>
                <Input
                  id="admin-user-password"
                  type="password"
                  autoComplete="new-password"
                  {...registerPassword("new_password")}
                />
                {passwordErrors.new_password ? (
                  <p className="text-destructive text-xs">{passwordErrors.new_password.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-user-password-confirm">Gentag adgangskode</Label>
                <Input
                  id="admin-user-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  {...registerPassword("confirm_password")}
                />
                {passwordErrors.confirm_password ? (
                  <p className="text-destructive text-xs">{passwordErrors.confirm_password.message}</p>
                ) : null}
              </div>
              {passwordError ? <p className="text-destructive text-sm">{passwordError}</p> : null}
              {passwordSuccess ? (
                <p className="text-sm text-green-700">Adgangskode er opdateret.</p>
              ) : null}
              <Button
                type="submit"
                variant="outline"
                className="border-star-navy text-star-navy"
                disabled={resettingPassword}
              >
                {resettingPassword ? "Opdaterer…" : "Skift adgangskode"}
              </Button>
            </form>
          </>
        )}
      </UserEditDialogPanel>
    </div>
  );
}

function UserEditDialogPanel({
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
  const [importingUsers, setImportingUsers] = useState(false);

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
    void loadList();
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
    void updateMembership(
      user,
      user.team_ids.filter((id) => id !== teamId),
    );
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
              className="wire-btn shrink-0"
              onClick={() => setImportingUsers(true)}
              disabled={!meta}
            >
              Importer CSV
            </button>
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
          onSaved={() => void loadList()}
        />
      ) : null}

      {addingToTeamUser ? (
        <AddToTeamDialog
          user={addingToTeamUser}
          teams={teams}
          onClose={() => setAddingToTeamUser(null)}
          onSaved={() => void loadList()}
        />
      ) : null}

      {creatingUser && meta ? (
        <AdminUserCreateDialog
          meta={meta}
          teams={teams}
          users={users}
          currentUserRole={currentUserRole}
          onClose={() => setCreatingUser(false)}
          onCreated={() => void loadList()}
        />
      ) : null}

      {importingUsers && meta ? (
        <AdminUserImportDialog
          roleOptions={meta.roles}
          currentUserRole={currentUserRole}
          onClose={() => setImportingUsers(false)}
          onImported={() => void loadList()}
        />
      ) : null}
    </section>
  );
}
