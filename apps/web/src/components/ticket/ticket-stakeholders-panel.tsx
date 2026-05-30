"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { UserMultiSelect } from "@/components/user-multi-select";
import { apiPatch } from "@/lib/api";
import type { Team } from "@/types/team";
import type { TicketDetail, TicketStakeholdersGrouped } from "@/types/ticket";

export function TicketStakeholdersPanel({
  ticket: initialTicket,
  teams,
  editable = true,
}: {
  ticket: TicketDetail;
  teams: Team[];
  editable?: boolean;
}) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initialTicket);
  const [affectedIds, setAffectedIds] = useState<string[]>([]);
  const [interestedIds, setInterestedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTicket(initialTicket);
    setAffectedIds(initialTicket.stakeholders?.affected.map((u) => u.user_id) ?? []);
    setInterestedIds(initialTicket.stakeholders?.interested.map((u) => u.user_id) ?? []);
  }, [initialTicket]);

  async function saveStakeholders(nextAffected: string[], nextInterested: string[]) {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiPatch<TicketDetail>(`/api/v1/tickets/${ticket.id}/metadata`, {
        affected_user_ids: nextAffected,
        interested_user_ids: nextInterested,
      });
      setTicket(updated);
      setAffectedIds(updated.stakeholders?.affected.map((u) => u.user_id) ?? []);
      setInterestedIds(updated.stakeholders?.interested.map((u) => u.user_id) ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme interessenter");
    } finally {
      setIsSaving(false);
    }
  }

  function handleAffectedChange(ids: string[]) {
    setAffectedIds(ids);
    if (editable) {
      void saveStakeholders(ids, interestedIds);
    }
  }

  function handleInterestedChange(ids: string[]) {
    setInterestedIds(ids);
    if (editable) {
      void saveStakeholders(affectedIds, ids);
    }
  }

  const stakeholders = ticket.stakeholders ?? emptyStakeholders();

  return (
    <div className="space-y-3 text-xs">
      {editable && teams.length > 0 ? (
        <>
          <div>
            <p className="text-[var(--gray-mid)] mb-1 font-medium">Berørte brugere</p>
            <UserMultiSelect
              teams={teams}
              selectedUserIds={affectedIds}
              onChange={handleAffectedChange}
              placeholder="Søg bruger til berørte…"
              disabled={isSaving}
            />
          </div>
          <div>
            <p className="text-[var(--gray-mid)] mb-1 font-medium">Interessenter</p>
            <UserMultiSelect
              teams={teams}
              selectedUserIds={interestedIds}
              onChange={handleInterestedChange}
              placeholder="Søg bruger til interessenter…"
              disabled={isSaving}
            />
          </div>
        </>
      ) : (
        <>
          <StakeholderList label="Berørte brugere" users={stakeholders.affected} />
          <StakeholderList label="Interessenter" users={stakeholders.interested} />
        </>
      )}
      {stakeholders.mentioned.length > 0 ? (
        <StakeholderList label="Nævnt i kommentarer" users={stakeholders.mentioned} />
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StakeholderList({
  label,
  users,
}: {
  label: string;
  users: TicketStakeholdersGrouped["affected"];
}) {
  return (
    <div>
      <p className="text-[var(--gray-mid)] mb-1 font-medium">{label}</p>
      {users.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-0.5">
          {users.map((user) => (
            <li key={user.user_id} className="text-star-navy font-medium">
              {user.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function emptyStakeholders(): TicketStakeholdersGrouped {
  return { affected: [], interested: [], mentioned: [] };
}
