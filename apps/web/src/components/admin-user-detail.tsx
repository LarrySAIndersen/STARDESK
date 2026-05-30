import Link from "next/link";
import type { ReactNode } from "react";

import { WireframeTicketTable } from "@/components/wireframe/wireframe-ticket-table";
import { displayNameInitials, formatDateTimeDa } from "@/lib/utils";
import type { UserAdminRead, UserTicketsGrouped } from "@/types/admin-user";
import type { Ticket } from "@/types/ticket";

function MetadataRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--gray-border)] py-2.5 last:border-0 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-muted-foreground text-xs font-bold uppercase tracking-wide">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function UserTicketSection({
  headingId,
  title,
  tickets,
}: {
  headingId: string;
  title: string;
  tickets: Ticket[];
}) {
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="wire-sec-title mb-3">
        {title}
      </h3>
      {tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm">Ingen sager i denne kategori.</p>
      ) : (
        <WireframeTicketTable tickets={tickets} />
      )}
    </section>
  );
}

export function AdminUserDetail({
  user,
  userTickets,
}: {
  user: UserAdminRead;
  userTickets: UserTicketsGrouped;
}) {
  const initials = displayNameInitials(user.display_name);

  return (
    <div className="mt-8 space-y-8">
      <Link
        href="/users"
        className="text-star-blue hover:text-star-navy inline-flex items-center gap-1 text-sm underline underline-offset-2"
      >
        ← Tilbage til brugere
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <span className="wire-avatar-sm bg-star-navy size-12 text-sm" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-star-navy text-2xl font-semibold tracking-tight">{user.display_name}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{user.email}</p>
          <span className="bg-star-blue-light text-star-navy mt-2 inline-block rounded-[2px] px-2 py-0.5 text-xs font-semibold">
            {user.role_label}
          </span>
          {!user.is_active ? (
            <span className="text-destructive ml-2 text-xs font-medium">Inaktiv konto</span>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="user-metadata-heading">
        <h3 id="user-metadata-heading" className="wire-sec-title mb-3">
          Metadata
        </h3>
        <div className="wire-card mb-0">
          <dl>
            <MetadataRow label="Rolle">{user.role_label}</MetadataRow>
            <MetadataRow label="Grupper">
              {user.teams.length === 0 ? (
                <span className="text-muted-foreground">Ingen grupper</span>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {user.teams.map((team) => (
                    <li key={team.id}>
                      <Link
                        href="/groups"
                        className="bg-star-blue-light text-star-navy hover:bg-star-navy/10 rounded-[2px] px-2 py-0.5 text-xs font-medium"
                      >
                        {team.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </MetadataRow>
            <MetadataRow label="Oprettet">{formatDateTimeDa(user.created_at)}</MetadataRow>
            <MetadataRow label="Organisation">
              {user.organization_name ?? (
                <span className="text-muted-foreground">Ingen organisation</span>
              )}
            </MetadataRow>
            <MetadataRow label="Status">
              {user.is_active ? "Aktiv" : "Inaktiv"}
            </MetadataRow>
            <MetadataRow label="E-mail">{user.email}</MetadataRow>
          </dl>
        </div>
      </section>

      <UserTicketSection
        headingId="user-reported-tickets-heading"
        title="Indmeldte sager"
        tickets={userTickets.reported}
      />
      <UserTicketSection
        headingId="user-assigned-tickets-heading"
        title="Tildelte sager"
        tickets={userTickets.assigned}
      />
      <UserTicketSection
        headingId="user-affected-tickets-heading"
        title="Berørte sager"
        tickets={userTickets.affected}
      />
      <UserTicketSection
        headingId="user-interested-tickets-heading"
        title="Interessent på"
        tickets={userTickets.interested}
      />
      {userTickets.mentioned.length > 0 ? (
        <UserTicketSection
          headingId="user-mentioned-tickets-heading"
          title="Nævnt i kommentarer"
          tickets={userTickets.mentioned}
        />
      ) : null}
    </div>
  );
}
