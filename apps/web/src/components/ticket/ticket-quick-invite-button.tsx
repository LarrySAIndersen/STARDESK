"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api";
import {
  buildAssignablePeople,
  filterPeopleForSearch,
  type SearchableOption,
} from "@/lib/assignment-search";
import { dispatchMentionsOverviewChanged } from "@/types/ticket-internal-chat";
import type { Team } from "@/types/team";

export function TicketQuickInviteButton({
  ticketId,
  teams,
}: Readonly<{
  ticketId: string;
  teams: Team[];
}>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const people = buildAssignablePeople(teams);
  const options = filterPeopleForSearch(people, query);

  async function invite(option: SearchableOption) {
    if (!option.id || busy) return;
    setBusy(true);
    try {
      await apiPost(`/api/v1/tickets/${ticketId}/internal-chat/invite`, {
        user_id: option.id,
      });
      dispatchMentionsOverviewChanged();
      setOpen(false);
      setQuery("");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="Indkald person til sag"
        title="Indkald person"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <UserPlus className="size-3.5" aria-hidden />
      </Button>
    );
  }

  return (
    <div
      className="min-w-[12rem]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <SearchableSelect
        valueId={null}
        displayValue=""
        options={options}
        placeholder="Vælg kollega…"
        emptyLabel="Ingen kollega fundet"
        allowClear={false}
        disabled={busy}
        onQueryChange={setQuery}
        onSelect={(option) => fireAndForget(invite(option))}
      />
    </div>
  );
}
