"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { displayNameInitials } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GroupedAdminUsers, UsersByTeamSection } from "@/lib/admin-users-grouping";
import type { UserAdminListItem } from "@/types/admin-user";

function UserRow({
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

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b py-2.5 last:border-0">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="wire-avatar-sm bg-star-navy mt-0.5 shrink-0" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-star-navy font-medium">{user.display_name}</p>
          <Link
            href={`/users/${user.id}`}
            className="text-star-blue hover:text-star-navy text-xs underline underline-offset-2"
          >
            se mere
          </Link>
          <p className="text-muted-foreground mt-1 truncate text-xs">{user.email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {user.role_label}
            {user.organization_name ? ` · ${user.organization_name}` : null}
            {user.team_names.length > 1 ? ` · ${user.team_names.join(", ")}` : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!user.is_active ? (
          <span className="text-destructive text-xs font-medium">Inaktiv</span>
        ) : null}
        {onAddToTeam ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onAddToTeam(user)}>
            Tilføj til gruppe
          </Button>
        ) : null}
        {onRemoveFromTeam && teamId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/5"
            onClick={() => onRemoveFromTeam(user, teamId)}
          >
            Fjern fra gruppe
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(user.id)}>
          Rediger
        </Button>
      </div>
    </li>
  );
}

function TeamUsersCard({
  section,
  onEdit,
  onRemoveFromTeam,
}: {
  section: UsersByTeamSection;
  onEdit: (userId: string) => void;
  onRemoveFromTeam: (user: UserAdminListItem, teamId: string) => void;
}) {
  return (
    <Card className="star-section-card overflow-hidden">
      <CardHeader className="bg-star-blue-light border-b py-4">
        <CardTitle className="text-star-navy text-base">{section.team.name}</CardTitle>
        {section.team.description ? (
          <CardDescription>{section.team.description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Brugere ({section.users.length})
        </p>
        {section.users.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ingen brugere i denne gruppe.</p>
        ) : (
          <ul>
            {section.users.map((user) => (
              <UserRow
                key={`${section.team.id}-${user.id}`}
                user={user}
                teamId={section.team.id}
                onEdit={onEdit}
                onRemoveFromTeam={onRemoveFromTeam}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TeamSectionGrid({
  sections,
  onEdit,
  onRemoveFromTeam,
}: {
  sections: UsersByTeamSection[];
  onEdit: (userId: string) => void;
  onRemoveFromTeam: (user: UserAdminListItem, teamId: string) => void;
}) {
  if (sections.length === 0) {
    return <p className="text-muted-foreground text-sm">Ingen grupper i denne kategori.</p>;
  }

  return (
    <ul className="grid gap-6">
      {sections.map((section) => (
        <li key={section.team.id}>
          <TeamUsersCard
            section={section}
            onEdit={onEdit}
            onRemoveFromTeam={onRemoveFromTeam}
          />
        </li>
      ))}
    </ul>
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
  return (
    <div className="mt-8 space-y-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-8">
        <section aria-labelledby="users-internal-heading">
          <h2 id="users-internal-heading" className="text-star-navy text-lg font-semibold tracking-tight">
            Interne grupper
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Brugere organiseret efter interne dispatch-grupper.
          </p>
          <div className="mt-4">
            <TeamSectionGrid
              sections={grouped.internal}
              onEdit={onEdit}
              onRemoveFromTeam={onRemoveFromTeam}
            />
          </div>
        </section>

        <section aria-labelledby="users-external-heading">
          <h2 id="users-external-heading" className="text-star-navy text-lg font-semibold tracking-tight">
            Eksterne grupper
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">Brugere i øvrige support- og driftsgrupper.</p>
          <div className="mt-4">
            <TeamSectionGrid
              sections={grouped.external}
              onEdit={onEdit}
              onRemoveFromTeam={onRemoveFromTeam}
            />
          </div>
        </section>
      </div>

      <section aria-labelledby="users-ungrouped-heading">
        <h2 id="users-ungrouped-heading" className="text-star-navy text-lg font-semibold tracking-tight">
          Uden gruppe
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Brugere der ikke er tilknyttet nogen dispatch-gruppe.
        </p>
        <Card className="star-section-card mt-4 overflow-hidden">
          <CardContent className="pt-4">
            {grouped.ungrouped.length === 0 ? (
              <p className="text-muted-foreground text-sm">Alle brugere er tilknyttet mindst én gruppe.</p>
            ) : (
              <ul>
                {grouped.ungrouped.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onEdit={onEdit}
                    onAddToTeam={onAddToTeam}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
