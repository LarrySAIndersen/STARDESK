import { redirect } from "next/navigation";

import { AdminChatbotPanel } from "@/components/admin-chatbot-panel";
import { canManageUsers } from "@/lib/auth";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function AdminChatbotPage() {
  const user = await getServerUser();
  if (!user) {
    redirect("/");
  }
  if (!canManageUsers(user)) {
    redirect("/");
  }

  return (
    <div className="wire-scroll-content space-y-4 px-4 py-4">
      <header>
        <h1 className="text-star-navy text-2xl font-bold tracking-tight">Chatbot-indstillinger</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Konfigurer sprogmodeller, system-instruktioner og visuelle indstillinger for STARdesk AI-assistenten (Help-a-bot / Sag-assistent).
        </p>
      </header>
      <AdminChatbotPanel />
    </div>
  );
}
