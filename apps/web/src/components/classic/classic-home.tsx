import Link from "next/link";

import { ClassicShellWrapper } from "@/components/classic/classic-shell-wrapper";
import { loadClassicBoardTickets } from "@/lib/classic-board-tickets";
import { CLASSIC_MODULES } from "@/lib/classic-modules";

async function loadCounts(): Promise<Record<string, number>> {
  const tickets = await loadClassicBoardTickets();
  if (tickets.length === 0) {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const classicModule of CLASSIC_MODULES) {
    counts[classicModule.id] = tickets.filter((t) => classicModule.match(t)).length;
  }
  return counts;
}

export async function ClassicHome() {
  const counts = await loadCounts();

  return (
    <ClassicShellWrapper title="Start">
      <div className="classic-page">
        <header className="classic-page__header">
          <h2 className="classic-page__title">Operatørstart</h2>
          <p className="classic-page__subtitle">
            Modulopdeling i TOPdesk-stil — incidents, changes, problems og service requests.
            Data hentes fra samme database som den moderne visning.
          </p>
        </header>

        <div className="classic-tiles">
          {CLASSIC_MODULES.map((classicModule) => (
            <Link key={classicModule.id} href={classicModule.href} className="classic-tile">
              <span className="classic-tile__label">{classicModule.label}</span>
              <span className="classic-tile__count">{counts[classicModule.id] ?? 0} åbne</span>
              <span className="classic-tile__hint">{classicModule.subtitle}</span>
            </Link>
          ))}
          <Link href="/classic/my-work" className="classic-tile classic-tile--accent">
            <span className="classic-tile__label">Mit arbejde</span>
            <span className="classic-tile__hint">Sager tildelt dig</span>
          </Link>
        </div>
      </div>
    </ClassicShellWrapper>
  );
}
