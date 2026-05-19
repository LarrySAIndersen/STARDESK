"use client";

import { Pencil, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn, displayNameInitials } from "@/lib/utils";
import type { GroupedAdminUsers, UsersByTeamSection } from "@/lib/admin-users-grouping";
import type { UserAdminListItem } from "@/types/admin-user";

type UsersTab = "internal" | "external" | "all";

const TAB_LABELS: { id: UsersTab; label: string }[] = [
  { id: "internal", label: "Interne" },
  { id: "external", label: "Eksterne" },
  { id: "all", label: "Alle" },
];

function AdminUsersTableHead() {
  return (
    <div
      className="wire-table-head wire-table-grid-admin-users min-w-[40rem]"
      role="row"
    >
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
  teamId,
}: {
  user: UserAdminListItem;
  onEdit: (userId: string) => void;
  onRemoveFromTeam?: (user: UserAdminListItem, teamId: string) => void;
  onAddToTeam?: (user: UserAdminListItem) => void;
  teamId?: string;
}) {
  const initials = displayNameInitials(user.display_name);
  const groupsLabel =
    user.team_names.length > 0 ? user.team_names.join(", ") : "—";

  return (
    <div
      role="row"
      className="wire-table-row wire-table-row--compact wire-table-grid-admin-users min-w-[40rem] items-center"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="wire-avatar-xs" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0">
          <p className="text-star-navy truncate text-xs font-medium leading-tight">
            {user.display_name}
          </p>
          <Link
            href={`/users/${user.id}`}
            className="text-star-blue hover:text-star-navy text-[10px] underline underline-offset-2"
          >
            se mere
          </Link>
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
        {onRemoveFromTeam && teamId ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive size-7"
            aria-label={`Fjern ${user.display_name} fra gruppe`}
            title="Fjern fra gruppe"
            onClick={() => onRemoveFromTeam(user, teamId)}
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

function TeamGroupSubheader({ section }: { section: UsersByTeamSection }) {
  const countLabel = section.users.length === 1 ? "bruger" : "brugere";
  return (
    <div
      role="row"
      className="wire-table-group-head min-w-[40rem]"
      aria-label={`${section.team.name}, ${section.users.length} ${countLabel}`}
    >
      <span className="col-span-full flex min-w-0 items-baseline gap-2">
        <span className="truncate">{section.team.name}</span>
        <span className="text-muted-foreground shrink-0 font-normal">
          — {section.users.length} {countLabel}
        </span>
      </span>
    </div>
  );
}

function TeamSectionsBlock({
  sections,
  onEdit,
  onRemoveFromTeam,
}: {
  sections: UsersByTeamSection[];
  onEdit: (userId: string) => void;
  onRemoveFromTeam: (user: UserAdminListItem, teamId: string) => void;
}) {
  const nonEmpty = sections.filter((section) => section.users.length > 0);

  return (
    <>
      {nonEmpty.map((section) => (
        <section key={section.team.id} aria-label={section.team.name}>
          <TeamGroupSubheader section={section} />
          {section.users.map((user) => (
            <AdminUserTableRow
              key={`${section.team.id}-${user.id}`}
              user={user}
              teamId={section.team.id}
              onEdit={onEdit}
              onRemoveFromTeam={onRemoveFromTeam}
            />
          ))}
        </section>
      ))}
    </>
  );
}

function UngroupedBlock({
  users,
  onEdit,
  onAddToTeam,
}: {
  users: UserAdminListItem[];
  onEdit: (userId: string) => void;
  onAddToTeam: (user: UserAdminListItem) => void;
}) {
  if (users.length === 0) {
    return null;
  }

  const countLabel = users.length === 1 ? "bruger" : "brugere";

  return (
    <section aria-label="Uden gruppe">
      <div
        role="row"
        className="wire-table-group-head min-w-[40rem]"
        aria-label={`Uden gruppe, ${users.length} ${countLabel}`}
      >
        <span className="col-span-full flex min-w-0 items-baseline gap-2">
          <span>Uden gruppe</span>
          <span className="text-muted-foreground shrink-0 font-normal">
            — {users.length} {countLabel}
          </span>
        </span>
      </div>
      {users.map((user) => (
        <AdminUserTableRow
          key={user.id}
          user={user}
          onEdit={onEdit}
          onAddToTeam={onAddToTeam}
        />
      ))}
    </section>
  );
}

function AdminUsersCompactTable({
  sections,
  ungrouped,
  onEdit,
  onRemoveFromTeam,
  onAddToTeam,
  showUngrouped,
}: {
  sections: UsersByTeamSection[];
  ungrouped: UserAdminListItem[];
  onEdit: (userId: string) => void;
  onRemoveFromTeam: (user: UserAdminListItem, teamId: string) => void;
  onAddToTeam: (user: UserAdminListItem) => void;
  showUngrouped: boolean;
}) {
  const hasTeamRows = sections.some((section) => section.users.length > 0);
  const hasUngrouped = showUngrouped && ungrouped.length > 0;

  return (
    <div className="overflow-x-auto">
      <div className="wire-table-wrap min-w-0">
        <AdminUsersTableHead />
        <TeamSectionsBlock
          sections={sections}
          onEdit={onEdit}
          onRemoveFromTeam={onRemoveFromTeam}
        />
        {hasUngrouped ? (
          <UngroupedBlock users={ungrouped} onEdit={onEdit} onAddToTeam={onAddToTeam} />
        ) : null}
        {!hasTeamRows && !hasUngrouped ? (
          <p className="text-muted-foreground px-3.5 py-4 text-sm">Ingen brugere i denne visning.</p>
        ) : null}
      </div>
    </div>
  );
}

export function AdminUsersGroupedSections({
  grouped,
  onEdit,
  onRemoveFromTeam,
  onAddToTeam,
}: {
  grouped: GroupedAdminUsers;
  onEdit: (userId: string) => void;
  onRemoveFromTeam: (user: UserAdminListItem, teamId: string) => void;
  onAddToTeam: (user: UserAdminListItem) => void;
}) {
  const [tab, setTab] = useState<UsersTab>("all");

  const tabSections = useMemo(() => {
    switch (tab) {
      case "internal":
        return grouped.internal;
      case "external":
        return grouped.external;
      case "all":
        return [...grouped.internal, ...grouped.external];
    }
  }, [grouped.external, grouped.internal, tab]);

  const tabCounts = useMemo(
    () => ({
      internal: grouped.internal.reduce((n, s) => n + s.users.length, 0),
      external: grouped.external.reduce((n, s) => n + s.users.length, 0),
      all:
        grouped.internal.reduce((n, s) => n + s.users.length, 0) +
        grouped.external.reduce((n, s) => n + s.users.length, 0) +
        grouped.ungrouped.length,
    }),
    [grouped.external, grouped.internal, grouped.ungrouped.length],
  );

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
            className={cn(
              "wire-btn wire-btn-sm",
              tab === id && "wire-btn-primary",
            )}
            onClick={() => setTab(id)}
          >
            {label}
            <span className="ml-1.5 font-normal tabular-nums opacity-80">
              ({tabCounts[id]})
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel">
        <AdminUsersCompactTable
          sections={tabSections}
          ungrouped={grouped.ungrouped}
          onEdit={onEdit}
          onRemoveFromTeam={onRemoveFromTeam}
          onAddToTeam={onAddToTeam}
          showUngrouped={tab === "all"}
        />
      </div>
    </div>
  );
}
