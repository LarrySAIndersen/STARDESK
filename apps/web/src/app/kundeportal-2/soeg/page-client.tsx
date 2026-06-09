"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { KP2_FORM_SCHEMAS } from "@/lib/kundeportal-2/form-schemas";
import { KP2_MOCK_CASES } from "@/lib/kundeportal-2/mock-data";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

export default function Kp2SoegPage() {
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const formHits = useMemo(() => {
    if (!q) return [];
    return KP2_FORM_SCHEMAS.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.helpText.toLowerCase().includes(q) ||
        f.id.includes(q),
    );
  }, [q]);

  const caseHits = useMemo(() => {
    if (!q) return [];
    return KP2_MOCK_CASES.filter(
      (c) => c.title.toLowerCase().includes(q) || c.number.toLowerCase().includes(q),
    );
  }, [q]);

  return (
    <div className="portal-v2-page mx-auto w-full max-w-3xl space-y-6 pb-10">
      <h1 className="kp2-page-title">Søgeresultater</h1>
      {q ? (
        <p className="text-muted-foreground text-sm">
          Resultater for &quot;{params.get("q")}&quot;
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">Indtast et søgeord i headeren.</p>
      )}

      {formHits.length > 0 ? (
        <section>
          <h2 className="kp2-section-title mb-2">Formularer</h2>
          <ul className="kp2-catalog-list">
            {formHits.map((form) => (
              <li key={form.id}>
                <Link href={`${KP2_BASE}/service-requests/${form.id}`} className="kp2-catalog-item">
                  {form.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {caseHits.length > 0 ? (
        <section>
          <h2 className="kp2-section-title mb-2">Sager</h2>
          <ul className="kp2-catalog-list">
            {caseHits.map((c) => (
              <li key={c.id}>
                <Link href={`${KP2_BASE}/mine-sager`} className="kp2-catalog-item">
                  {c.number} — {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {q && formHits.length === 0 && caseHits.length === 0 ? (
        <p className="kp2-empty">Ingen resultater fundet.</p>
      ) : null}
    </div>
  );
}
