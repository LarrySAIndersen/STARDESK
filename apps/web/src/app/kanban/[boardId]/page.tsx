import { notFound, redirect } from "next/navigation";

import { KanbanBoardView } from "@/components/kanban/kanban-board-view";
import { ApiError } from "@/lib/api";
import { apiGetServer } from "@/lib/api-server";
import { canManageUsers, isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";
import type { KanbanBoardDetail, KanbanBoardSummary } from "@/types/kanban";
import type { Team } from "@/types/team";
import type { User } from "@/types/user";

export const dynamic = "force-dynamic";

export default async function KanbanBoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  try {
    const admin = canManageUsers(user);
    const [detail, boards, teams, usersResponse] = await Promise.all([
      apiGetServer<KanbanBoardDetail>(`/api/v1/kanban/boards/${boardId}`),
      apiGetServer<KanbanBoardSummary[]>("/api/v1/kanban/boards").catch(
        () => [] as KanbanBoardSummary[],
      ),
      apiGetServer<Team[]>("/api/v1/teams").catch(() => [] as Team[]),
      admin
        ? apiGetServer<{ items: User[] }>("/api/v1/users?page_size=100").catch(
            () => ({ items: [] as User[] }),
          )
        : Promise.resolve({ items: [] as User[] }),
    ]);
    const users = usersResponse.items;
    return (
      <KanbanBoardView
        initialDetail={detail}
        boards={boards}
        teams={teams}
        users={users}
        currentUser={user}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    if (error instanceof ApiError && error.status === 403) {
      redirect("/kanban");
    }
    throw error;
  }
}
