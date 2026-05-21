import { ClassicModuleTable } from "@/components/classic/classic-module-table";
import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { apiGetServer } from "@/lib/api-server";
import type { ClassicModuleDef } from "@/lib/classic-modules";
import type { Ticket } from "@/types/ticket";

async function loadBoardTickets(): Promise<Ticket[]> {
  try {
    return await apiGetServer<Ticket[]>("/api/v1/tickets?board=true&limit=500&open_only=true");
  } catch {
    return [];
  }
}

export async function ClassicModulePage({
  module: classicModule,
  extraFilter,
}: {
  module: ClassicModuleDef;
  /** Optional filter (e.g. my-work: assigned to current user). */
  extraFilter?: (ticket: Ticket) => boolean;
}) {
  const all = await loadBoardTickets();
  const filtered = all.filter(
    (t) => classicModule.match(t) && (extraFilter ? extraFilter(t) : true),
  );

  return (
    <ClassicShellWrapper title={classicModule.label}>
      <div className="classic-page">
        <header className="classic-page__header">
          <h2 className="classic-page__title">{classicModule.label}</h2>
          <p className="classic-page__subtitle">{classicModule.subtitle}</p>
          <p className="classic-page__meta">
            {filtered.length} åbne sager · samme data som moderne STARdesk
          </p>
        </header>
        <ClassicModuleTable
          tickets={filtered}
          emptyMessage={`Ingen åbne sager i ${classicModule.label.toLowerCase()}.`}
        />
      </div>
    </ClassicShellWrapper>
  );
}
