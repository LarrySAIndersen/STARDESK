"use client";

import { Mail, Pencil, UserMinus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayNameInitials } from "@/lib/utils";
import type { UserAdminListItem } from "@/types/admin-user";

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return <span className="wire-badge wire-badge--resolved">Aktiv</span>;
  }
  return <span className="wire-badge wire-badge--critical">Inaktiv</span>;
}

/** Person card aligned with ticket detail TOPdesk-style wire-card (Indmelder). */
export function AdminUserCard({
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
    user.team_names.length > 0 ? user.team_names.join(", ") : "Ingen gruppe";

  return (
    <article className="wire-card admin-user-card mb-0 flex h-full min-h-[200px] flex-col">
      <h2 className="wire-card-title">Bruger</h2>

      <div className="flex flex-1 items-start gap-3">
        <div
          className="bg-star-navy flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="text-star-navy hover:text-star-blue text-left text-base font-semibold underline-offset-2 hover:underline"
            onClick={() => onEdit(user.id)}
          >
            {user.display_name}
          </button>
          <p
            className="text-muted-foreground mt-1 flex items-center gap-1 text-xs"
            title={user.email}
          >
            <Mail className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{user.email}</span>
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="text-star-navy font-medium">{user.role_label}</span>
            {user.organization_name ? ` · ${user.organization_name}` : null}
          </p>
          <p className="text-muted-foreground mt-1 text-xs" title={groupsLabel}>
            Grupper: {groupsLabel}
          </p>
          <div className="mt-2">
            <UserStatusBadge isActive={user.is_active} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-0.5 border-t border-[var(--gray-border)] pt-2">
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
    </article>
  );
}
