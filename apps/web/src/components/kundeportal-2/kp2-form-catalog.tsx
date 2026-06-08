"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Kp2Icon } from "@/components/kundeportal-2/kp2-icon";
import {
  KP2_CATEGORY_LABELS,
  KP2_BASE,
  type Kp2FormCategory,
} from "@/lib/kundeportal-2/types";
import { getKp2FormsByCategory } from "@/lib/kundeportal-2/form-schemas";

const CATEGORY_ORDER: Kp2FormCategory[] = [
  "adgang-brugere",
  "data",
  "fejl-aendringer",
  "generelt",
];

export function Kp2FormCatalog() {
  const grouped = getKp2FormsByCategory();

  return (
    <div className="kp2-page mx-auto max-w-5xl space-y-8 p-4 pb-12 sm:p-6">
      <header className="space-y-2">
        <h1 className="kp2-page-title">Service Requests & Changes</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          En service request er en anmodning om information, rådgivning eller adgang til en
          bestemt tjeneste.
        </p>
      </header>

      {CATEGORY_ORDER.map((category) => {
        const forms = grouped.get(category) ?? [];
        if (forms.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`kp2-cat-${category}`}>
            <h2 id={`kp2-cat-${category}`} className="kp2-section-title mb-3">
              {KP2_CATEGORY_LABELS[category]}
            </h2>
            <ul className="kp2-catalog-list">
              {forms.map((form) => (
                <li key={form.id}>
                  <Link
                    href={`${KP2_BASE}/service-requests/${form.id}`}
                    className="kp2-catalog-item"
                  >
                    <Kp2Icon name={form.icon} className="size-5 shrink-0 opacity-80" />
                    <span className="flex-1 font-medium">{form.title}</span>
                    <ChevronRight className="size-4 opacity-50" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
