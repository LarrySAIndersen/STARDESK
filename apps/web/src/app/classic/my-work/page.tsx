import { ClassicModuleTable } from "@/components/classic/classic-module-table";
import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { apiGetServer } from "@/lib/api-server";
import { getServerUser } from "@/lib/auth-server";
import type { Ticket } from "@/types/ticket";

export const dynamic = "force-dynamic";

export default async function ClassicMyWorkPage() {
  const user = await getServerUser();
  let tickets: Ticket[] = [];
  try {
    tickets = await apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500&open_only=true");
  } catch {
    tickets = [];
  }

  const mine = user
    ? tickets.filter((t) => t.assigned_user_id === user.id)
    : [];

  return (
    <ClassicShellWrapper title="Mit arbejde">
      <div className="classic-page">
        <header className="classic-page__header">
          <h2 className="classic-page__title">Mit arbejde</h2>
          <p className="classic-page__subtitle">
            Åbne sager tildelt dig — tilsvarende &quot;Mine sager&quot; i TOPdesk.
          </p>
          <p className="classic-page__meta">{mine.length} sager</p>
        </header>
        <ClassicModuleTable tickets={mine} emptyMessage="Ingen åbne sager tildelt dig." />
      </div>
    </ClassicShellWrapper>
  );
}
