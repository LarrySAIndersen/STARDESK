import Link from "next/link";

import { formatKp2Date } from "@/lib/kundeportal-2/mock-data";
import type { Kp2ServiceMessage } from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

export function Kp2ServiceMessageDetail({ message }: { message: Kp2ServiceMessage }) {
  return (
    <div className="kp2-page mx-auto max-w-4xl space-y-6 p-4 pb-12 sm:p-6">
      <header className="space-y-1">
        <h1 className="kp2-page-title">{message.title}</h1>
        <p className="text-muted-foreground font-mono text-sm">52511-2675</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <article className="kp2-card p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="kp2-message-icon" aria-hidden>
                !
              </div>
              <div>
                <h2 className="font-semibold">Omfattende serviceafbrydelse</h2>
                <p className="text-muted-foreground text-xs">
                  Registreret {formatKp2Date(message.registeredAt)}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{message.summary}</p>
          </article>

          <section aria-label="Opdateringer">
            {message.updates.map((update) => (
              <article key={update.id} className="kp2-update-card">
                <div className="kp2-update-avatar" aria-hidden />
                <div>
                  <p className="text-sm font-medium">
                    {update.author}{" "}
                    <span className="text-muted-foreground font-normal">
                      {formatKp2Date(update.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{update.body}</p>
                </div>
              </article>
            ))}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="kp2-status-badge">Behandler</div>
          <button type="button" className="kp2-btn-primary w-full">
            Jeg er paavirket af denne afbrydelse
          </button>
          <dl className="kp2-card space-y-2 p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{message.type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kategorisering</dt>
              <dd>{message.categorization}</dd>
            </div>
          </dl>
          <Link href={KP2_BASE} className="text-primary text-sm underline">
            Tilbage til forsiden
          </Link>
        </aside>
      </div>
    </div>
  );
}
