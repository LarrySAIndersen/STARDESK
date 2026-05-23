import { redirect } from "next/navigation";

import { KanbanLanding } from "@/components/kanban/kanban-landing";
import { apiGetServer } from "@/lib/api-server";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { KanbanBoardSummary } from "@/types/kanban";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  let boards: KanbanBoardSummary[] = [];
  try {
    boards = await apiGetServer<KanbanBoardSummary[]>("/api/v1/kanban/boards");
  } catch {
    boards = [];
  }

  if (boards.length === 1) {
    redirect(`/kanban/${boards[0].id}`);
  }

  return <KanbanLanding boards={boards} />;
}
