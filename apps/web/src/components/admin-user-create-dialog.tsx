"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo, useState, type ReactNode, type RefObject } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { AdminRoleCheckboxList } from "@/components/admin-role-checkbox-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiGet, apiPost } from "@/lib/api";
import type {
  UserAdminCreated,
  UserAdminCreateInput,
  UserAdminListItem,
  UserAdminMeta,
  UserAdminRead,
} from "@/types/admin-user";
import type { Team } from "@/types/team";
import type { UserRole } from "@/types/user";

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const userRoleValues = [
  "end_user",
  "agent",
  "admin",
  "top_admin",
  "supporter",
  "stardesk_reviewer",
] as const;

const createSchema = z
  .object({
    email: z.string().email("Ugyldig e-mail"),
    display_name: z.string().min(1, "Navn er påkrævet"),
    roles: z.array(z.enum(userRoleValues)).min(1, "Vælg mindst én rettighedsgruppe"),
    is_active: z.boolean(),
    organization_id: z.string(),
    team_ids: z.array(z.string()),
    clone_from_user_id: z.string(),
    initial_password: z.string(),
    confirm_password: z.string(),
  })
  .refine(
    (data) => {
      if (!data.initial_password && !data.confirm_password) {
        return true;
      }
      return data.initial_password.length >= 8 && data.initial_password === data.confirm_password;
    },
    {
      message: "Adgangskoderne matcher ikke (mindst 8 tegn)",
      path: ["confirm_password"],
    },
  );

type CreateFormValues = z.infer<typeof createSchema>;

const defaultValues: CreateFormValues = {
  email: "",
  display_name: "",
  roles: ["agent"],
  is_active: true,
  organization_id: "",
  team_ids: [],
  clone_from_user_id: "",
  initial_password: "",
  confirm_password: "",
};

function suggestCloneEmail(sourceEmail: string): string {
  const at = sourceEmail.indexOf("@");
  if (at <= 0) {
    return "";
  }
  const local = sourceEmail.slice(0, at);
  const domain = sourceEmail.slice(at + 1);
  return `kopia-af-${local}@${domain}`;
}

function UserCreateDialogPanel({
  ref,
  titleId,
  onClose,
  children,
}: {
  ref: RefObject<HTMLDivElement | null>;
  titleId: string;
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
          Opret bruger
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Luk">
          ✕
        </Button>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function AdminUserCreateDialog({
  meta,
  teams,
  users,
  currentUserRole,
  onClose,
  onCreated,
}: {
  meta: UserAdminMeta;
  teams: Team[];
  users: UserAdminListItem[];
  currentUserRole: UserRole;
  onClose: () => void;
  onCreated: () => void;
}) {
  const titleId = useId();
  const panelRef = useFocusTrap(true, onClose);
  const [cloneSearch, setCloneSearch] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(false);

  const roleOptions = useMemo(
    () =>
      meta.roles.filter(
        (role) => currentUserRole === "top_admin" || role.value !== "top_admin",
      ),
    [currentUserRole, meta.roles],
  );

  const cloneOptions = useMemo(() => {
    const term = cloneSearch.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => a.display_name.localeCompare(b.display_name, "da"));
    if (!term) {
      return sorted.slice(0, 80);
    }
    return sorted
      .filter(
        (user) =>
          user.display_name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term),
      )
      .slice(0, 80);
  }, [cloneSearch, users]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues,
  });

  const selectedTeamIds = watch("team_ids") ?? [];
  const selectedRoles = watch("roles") ?? [];
  const cloneFromUserId = watch("clone_from_user_id");

  useEffect(() => {
    if (!cloneFromUserId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setCloneLoading(true);
      try {
        const source = await apiGet<UserAdminRead>(`/api/v1/users/${cloneFromUserId}`);
        if (cancelled) {
          return;
        }
        reset({
          ...defaultValues,
          email: suggestCloneEmail(source.email),
          display_name: `${source.display_name} (kopi)`,
          roles: (source.roles?.length
            ? source.roles
            : [source.role]) as CreateFormValues["roles"],
          is_active: source.is_active,
          organization_id: source.organization_id ?? "",
          team_ids: source.teams.map((team) => team.id),
          clone_from_user_id: cloneFromUserId,
        });
      } catch {
        if (!cancelled) {
          setSaveError("Kunne ikke hente bruger til kloning");
        }
      } finally {
        if (!cancelled) {
          setCloneLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloneFromUserId, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaveError(null);
    setGeneratedPassword(null);
    setSaving(true);
    try {
      const payload: UserAdminCreateInput = {
        email: values.email.trim().toLowerCase(),
        display_name: values.display_name.trim(),
        roles: values.roles,
        is_active: values.is_active,
        organization_id: values.organization_id ? values.organization_id : null,
        team_ids: values.team_ids,
        clone_from_user_id: values.clone_from_user_id || null,
      };
      if (values.initial_password) {
        payload.initial_password = values.initial_password;
      }
      const result = await apiPost<UserAdminCreated>("/api/v1/users", payload);
      if (result.temporary_password) {
        setGeneratedPassword(result.temporary_password);
      }
      onCreated();
      if (!result.temporary_password) {
        onClose();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Kunne ikke oprette bruger");
    } finally {
      setSaving(false);
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
      <UserCreateDialogPanel ref={panelRef} titleId={titleId} onClose={onClose}>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <section className="space-y-2">
            <h3 className="text-star-navy text-sm font-semibold">Klon fra eksisterende bruger</h3>
            <Label htmlFor="clone-user-search">Vælg bruger at kopiere indstillinger fra</Label>
            <Input
              id="clone-user-search"
              type="search"
              placeholder="Søg navn eller e-mail…"
              value={cloneSearch}
              onChange={(event) => setCloneSearch(event.target.value)}
              autoComplete="off"
            />
            <select
              id="clone-from-user"
              className={selectClassName}
              disabled={cloneLoading}
              {...register("clone_from_user_id")}
            >
              <option value="">Ingen kloning</option>
              {cloneOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name} ({user.email})
                </option>
              ))}
            </select>
            {cloneLoading ? (
              <p className="text-muted-foreground text-xs">Henter indstillinger…</p>
            ) : null}
          </section>

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="create-user-email">E-mail</Label>
            <Input id="create-user-email" type="email" autoComplete="off" {...register("email")} />
            <p className="text-muted-foreground text-xs">
              E-mail skal være unik. Ved kloning foreslås en ny adresse — ret den før oprettelse.
            </p>
            {errors.email ? (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-user-name">Navn</Label>
            <Input id="create-user-name" {...register("display_name")} />
            {errors.display_name ? (
              <p className="text-destructive text-xs">{errors.display_name.message}</p>
            ) : null}
          </div>

          <AdminRoleCheckboxList
            label="Rolle"
            roleOptions={roleOptions}
            selectedRoles={selectedRoles}
            onChange={(roles) => setValue("roles", roles, { shouldDirty: true, shouldValidate: true })}
            error={errors.roles?.message}
          />

          <div className="space-y-2">
            <Label htmlFor="create-user-org">Organisation</Label>
            <select id="create-user-org" className={selectClassName} {...register("organization_id")}>
              <option value="">Ingen</option>
              {meta.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Grupper</Label>
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
              id="create-user-active"
              type="checkbox"
              className="size-4 rounded border"
              {...register("is_active")}
            />
            <Label htmlFor="create-user-active" className="font-normal">
              Aktiv konto
            </Label>
          </div>

          <section className="space-y-3 border-t pt-4">
            <h3 className="text-star-navy text-sm font-semibold">Adgangskode</h3>
            <p className="text-muted-foreground text-xs">
              Lad felterne være tomme for at generere en midlertidig adgangskode (brugeren skal skifte
              ved første login). Eller angiv en startadgangskode her.
            </p>
            <div className="space-y-2">
              <Label htmlFor="create-user-password">Startadgangskode</Label>
              <Input
                id="create-user-password"
                type="password"
                autoComplete="new-password"
                {...register("initial_password")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-user-password-confirm">Gentag adgangskode</Label>
              <Input
                id="create-user-password-confirm"
                type="password"
                autoComplete="new-password"
                {...register("confirm_password")}
              />
              {errors.confirm_password ? (
                <p className="text-destructive text-xs">{errors.confirm_password.message}</p>
              ) : null}
            </div>
          </section>

          {generatedPassword ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              Bruger oprettet. Midlertidig adgangskode:{" "}
              <strong className="font-mono">{generatedPassword}</strong> — gem den nu; den vises ikke
              igen.
            </p>
          ) : null}

          {saveError ? <p className="text-destructive text-sm">{saveError}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {generatedPassword ? "Luk" : "Annuller"}
            </Button>
            {!generatedPassword ? (
              <Button type="submit" className="bg-star-blue hover:bg-star-navy" disabled={saving}>
                {saving ? "Opretter…" : "Opret bruger"}
              </Button>
            ) : null}
          </div>
        </form>
      </UserCreateDialogPanel>
    </div>
  );
}
