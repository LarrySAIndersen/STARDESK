import { ClassicModuleTable } from "@/components/classic/classic-module-table";
import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { loadClassicBoardTickets } from "@/lib/classic-board-tickets";
import { getServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function ClassicMyWorkPage() {
  const user = await getServerUser();
  const tickets = await loadClassicBoardTickets();

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
