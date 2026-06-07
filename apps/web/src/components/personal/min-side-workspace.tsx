"use client";

import { useCallback, useState } from "react";

import { PostItAttachProvider } from "@/components/personal/post-it-attach-provider";
import { PersonalBulletinBoard } from "@/components/personal/personal-bulletin-board";
import { MyTicketsSection, PersonalKanbanBoard } from "@/components/personal/personal-kanban-board";
import { PERSONAL_KANBAN_COLUMNS, type PersonalKanban, type PersonalNote } from "@/types/personal";
import type { UserTicketsGrouped } from "@/types/admin-user";
import type { Ticket } from "@/types/ticket";

export function MinSideWorkspace({
  initialNotes,
  initialKanban,
  userTickets,
  assignableTickets,
}: {
  initialNotes: PersonalNote[];
  initialKanban: PersonalKanban;
  userTickets: UserTicketsGrouped;
  assignableTickets: Ticket[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [kanban, setKanban] = useState(initialKanban);

  const refreshKanban = useCallback(async () => {
    const res = await fetch("/api/proxy/v1/personal/kanban", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as PersonalKanban;
    setKanban(data);
  }, []);

  return (
    <PostItAttachProvider
      onNoteUpdated={(note) =>
        setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)))
      }
    >
    <div className="flex flex-col gap-6">
      <PersonalBulletinBoard
        notes={notes}
        onNotesChange={setNotes}
        kanban={kanban}
        onKanbanRefresh={refreshKanban}
      />
      <PersonalKanbanBoard
        kanban={kanban}
        assignableTickets={assignableTickets}
        hiddenColumns={[PERSONAL_KANBAN_COLUMNS[0]]}
        onKanbanChange={setKanban}
      />
      <MyTicketsSection
        userTickets={userTickets}
        boardTicketIds={new Set(kanban.cards.map((c) => c.ticket_id))}
      />
    </div>
    </PostItAttachProvider>
  );
}
