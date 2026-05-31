"use client";

import { Label } from "@/components/ui/label";
import type { RoleOption } from "@/types/admin-user";
import type { UserRole } from "@/types/user";

const ROLE_VALUES: UserRole[] = [
  "end_user",
  "agent",
  "admin",
  "top_admin",
  "supporter",
  "stardesk_reviewer",
];

export function AdminRoleCheckboxList({
  label = "Rettighedsgruppe",
  roleOptions,
  selectedRoles,
  onChange,
  error,
}: {
  label?: string;
  roleOptions: RoleOption[];
  selectedRoles: UserRole[];
  onChange: (roles: UserRole[]) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="border-input max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
        {roleOptions.map((role) => {
          const value = role.value as UserRole;
          if (!ROLE_VALUES.includes(value)) {
            return null;
          }
          return (
            <label key={role.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border"
                checked={selectedRoles.includes(value)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selectedRoles, value]
                    : selectedRoles.filter((r) => r !== value);
                  onChange(next);
                }}
              />
              {role.label}
            </label>
          );
        })}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
