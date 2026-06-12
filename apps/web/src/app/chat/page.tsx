import { redirect } from "next/navigation";

import { ChatWorkspacePanel } from "@/components/team-chat/chat-workspace-panel";
import { isStaff } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function TeamChatPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!isStaff(user)) {
    redirect("/portal");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatWorkspacePanel layout="page" />
    </div>
  );
}
