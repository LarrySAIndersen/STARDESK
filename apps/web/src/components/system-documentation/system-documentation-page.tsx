import { BookOpen, ExternalLink } from "lucide-react";

import {
  SYSTEM_DOCS_GITHUB_BASE,
  SYSTEM_DOCUMENTATION_ENTRIES,
  systemDocumentationHref,
} from "@/lib/system-documentation";

export function SystemDocumentationPage() {
  return (
    <div className="wire-scroll-content min-h-0 flex-1 space-y-6 px-4 py-4">
      <header className="max-w-3xl">
        <div className="flex items-center gap-2">
          <BookOpen className="text-star-navy size-6 shrink-0" aria-hidden />
          <h1 className="text-star-navy text-2xl font-bold tracking-tight">Systemdokumentation</h1>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          Teknisk dokumentation til drift, fejlsøgning og genskabelse af STARDESK. Dokumenterne
          vedligeholdes i repo&apos;ets <code>docs/</code>-mappe.
        </p>
      </header>

      <section aria-labelledby="system-docs-list-heading">
        <h2 id="system-docs-list-heading" className="text-star-navy mb-3 text-lg font-semibold">
          Dokumenter
        </h2>
        <ul className="grid max-w-4xl gap-3 sm:grid-cols-2">
          {SYSTEM_DOCUMENTATION_ENTRIES.map((entry) => (
            <li key={entry.id}>
              <a
                href={systemDocumentationHref(entry.filename)}
                target="_blank"
                rel="noopener noreferrer"
                className="wire-card hover:border-star-navy flex h-full flex-col gap-2 p-4 transition-colors"
              >
                <span className="text-star-navy flex items-center gap-1.5 font-semibold">
                  {entry.title}
                  <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden />
                </span>
                <span className="text-muted-foreground text-xs">{entry.description}</span>
                <span className="text-muted-foreground mt-auto font-mono text-[10px]">
                  docs/{entry.filename}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-muted-foreground max-w-3xl text-xs">
        Fuld mappe på GitHub:{" "}
        <a
          href={SYSTEM_DOCS_GITHUB_BASE}
          target="_blank"
          rel="noopener noreferrer"
          className="text-star-blue hover:underline"
        >
          {SYSTEM_DOCS_GITHUB_BASE}
        </a>
      </p>
    </div>
  );
}
