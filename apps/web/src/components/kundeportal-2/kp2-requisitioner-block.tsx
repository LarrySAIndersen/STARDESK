import type { User } from "@/types/user";

export function Kp2RequisitionerBlock({ user }: { user: User | null }) {
  const name = user?.display_name ?? "-";
  const email = user?.email ?? "-";
  const branch = user?.organization_name ?? "STAR City";

  return (
    <section className="kp2-card p-4 sm:p-5" aria-labelledby="kp2-rekvirent-heading">
      <h2 id="kp2-rekvirent-heading" className="kp2-section-title mb-3">
        Rekvirent
      </h2>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Navn</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Filial</dt>
          <dd className="font-medium">{branch}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="font-medium">{email}</dd>
        </div>
      </dl>
    </section>
  );
}
