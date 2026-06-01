"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  AdminUserDialogPanel,
  AdminUserModalBackdrop,
  adminUserSelectClassName,
} from "@/components/admin-user-dialog-panel";
import { AdminRoleCheckboxList } from "@/components/admin-role-checkbox-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { adminUserPasswordSchema, adminUserRoleValues } from "@/lib/admin-user-form";
import { apiGet, apiPatch, apiPostNoContent } from "@/lib/api";
import type {
  UserAdminMeta,
  UserAdminRead,
  UserAdminUpdateInput,
} from "@/types/admin-user";
import type { Team } from "@/types/team";
import type { UserRole } from "@/types/user";

const profileSchema = z.object({
  display_name: z.string().min(1, "Navn er påkrævet"),
  email: z.string().email("Ugyldig e-mail"),
  roles: z.array(z.enum(adminUserRoleValues)).min(1, "Vælg mindst én rettighedsgruppe"),
  is_active: z.boolean(),
  password_policy_exempt: z.boolean(),
  organization_id: z.string(),
  team_ids: z.array(z.string()),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof adminUserPasswordSchema>;

export function AdminUserEditDialog({
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
  const selectedRoles = watch("roles") ?? [];

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(adminUserPasswordSchema),
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
          roles: (detail.roles?.length
            ? detail.roles
            : [detail.role]) as ProfileFormValues["roles"],
          is_active: detail.is_active,
          password_policy_exempt: detail.password_policy_exempt,
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
        roles: values.roles,
        is_active: values.is_active,
        password_policy_exempt: values.password_policy_exempt,
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
    <AdminUserModalBackdrop onClose={onClose}>
      <AdminUserDialogPanel
        ref={panelRef}
        titleId={titleId}
        title={user?.display_name ?? "Bruger"}
        onClose={onClose}
      >
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

              <AdminRoleCheckboxList
                roleOptions={roleOptions}
                selectedRoles={selectedRoles}
                onChange={(roles) => setValue("roles", roles, { shouldDirty: true, shouldValidate: true })}
                error={errors.roles?.message}
              />

              <div className="space-y-2">
                <Label htmlFor="admin-user-org">Organisation</Label>
                <select id="admin-user-org" className={adminUserSelectClassName} {...register("organization_id")}>
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

              <div className="flex items-center gap-2">
                <input
                  id="admin-user-password-exempt"
                  type="checkbox"
                  className="size-4 rounded border"
                  {...register("password_policy_exempt")}
                />
                <Label htmlFor="admin-user-password-exempt" className="font-normal">
                  Undtaget fra adgangskodepolitik
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
      </AdminUserDialogPanel>
    </AdminUserModalBackdrop>
  );
}
