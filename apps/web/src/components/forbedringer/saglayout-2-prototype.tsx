"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  ImageIcon,
  Lightbulb,
  Link2,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { KnowledgeMergeFieldText } from "@/components/forbedringer/knowledge-merge-field-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildMergeField, MERGE_FIELD_HELP_DA } from "@/lib/knowledge-merge-fields";
import { cn } from "@/lib/utils";

const MOCK = {
  ticketNumber: "INC-2026-00087",
  ticketId: "13c9d50c-c669-4b70-bb58-7ca35802f061",
  title: "test certifiakt",
  description: "sadadadada",
  status: "I arbejde",
  reporter: "Bo",
  assignee: "Emilio",
  team: "SF Service Desk",
  category: "Hardware",
  subcategory: "Generelt",
  priority: "Kritisk",
  source: "Selvbetjening",
  slaLabel: "SLA OVERSKREDET",
  slaDetail: "9d 23t 24m overskredet",
  comments: [
    {
      id: "1",
      author: "Larrysanders",
      body: "test",
      at: "30. maj 2026 kl. 22.03",
      external: true,
    },
    {
      id: "2",
      author: "Larrysanders",
      body: "committe og pushe til main",
      at: "30. maj 2026 kl. 22.04",
      external: true,
    },
  ],
  images: [
    { id: "a1", label: "INC-2026-00087-20260530-220357.png", at: "30.05.2026, 22.03" },
    { id: "a2", label: "INC-2026-00087-20260530-220404.png", at: "30.05.2026, 22.04" },
    { id: "a3", label: "INC-2026-00087-20260530-221157.png", at: "30.05.2026, 22.11" },
  ],
  linkedArticles: [
    {
      id: "kb-1",
      number: "KB-2024-00001",
      title: "Printer viser certifikatfejl ved udskrivning",
      status: "Udgivet",
      excerpt: "Løsning testet på {{sag:INC-2026-00087}}. Se også {{kb:KB-2024-00012}}.",
    },
    {
      id: "kb-2",
      number: "KB-2024-00012",
      title: "Geninstallér printercertifikat på Windows",
      status: "Kladde",
      excerpt: "Relateret til {{sag:INC-2026-00087}} efter eskalering.",
    },
  ],
  suggestedArticles: [
    { number: "KB-2024-00001", title: "Printer viser certifikatfejl ved udskrivning", score: 92 },
    { number: "KB-2024-00008", title: "Hardware — generel fejlfinding", score: 61 },
  ],
};

const RECOMMENDATIONS = [
  "Billeder flyttes til højre sidebar som vertikal miniaturliste — beskeder forbliver ren tekst.",
  "Én sagvisning: drop dobbelt billede-område (portal + klassisk wireframe).",
  "Vidensartikler kobles med flet-felter {{sag:…}} og {{kb:…}} — klikbare begge veje.",
  "Faner for E-mail / Hierarki / AI under hovedindhold — mindre scroll.",
  "Sticky handlingslinje: Tildel · Løs · Luk · Opret vidensartikel.",
] as const;

type TabId = "beskeder" | "email" | "handlinger";

function MockImageThumb({ label, at }: { label: string; at: string }) {
  return (
    <div className="border-border flex gap-2 rounded-[2px] border p-2">
      <div className="bg-muted/50 text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-[2px] border">
        <ImageIcon className="size-5 opacity-60" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium break-all leading-snug">{label}</p>
        <p className="text-muted-foreground mt-0.5 text-[10px]">Godkendt · {at}</p>
      </div>
    </div>
  );
}

export function Saglayout2Prototype() {
  const [tab, setTab] = useState<TabId>("beskeder");

  return (
    <div className="space-y-6">
      <section className="wire-card border-star-navy/20 bg-gradient-to-br from-[#f8fafc] to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-3">
          <div className="bg-star-navy/10 text-star-navy flex size-10 items-center justify-center rounded-full">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              UI-ekspert — forslag
            </p>
            <h1 className="text-star-navy mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
              Saglayout #2
            </h1>
            <p className="text-muted-foreground mt-2 max-w-3xl text-[14px] leading-relaxed">
              Udkast baseret på nuværende sag INC-2026-00087. Målet er mindre scroll, tydelig
              adskillelse af tekst og billeder, og tæt kobling til vidensartikler via flet-felter
              der kan genfindes på både sagen og artiklen.
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-900">
            Prototype — ikke produktion
          </Badge>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {RECOMMENDATIONS.map((item) => (
            <li
              key={item}
              className="border-border flex gap-2 rounded-[2px] border bg-white/80 px-3 py-2 text-[13px] leading-snug"
            >
              <Lightbulb className="text-star-navy mt-0.5 size-4 shrink-0 opacity-70" aria-hidden />
              {item}
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground mt-4 text-[12px]">
          <Link2 className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
          {MERGE_FIELD_HELP_DA}
        </p>
      </section>

      <section
        className="portal-v2-page mx-auto w-full max-w-6xl space-y-4 rounded-[2px] border-2 border-dashed border-[var(--gray-border)] bg-[var(--gray-bg)] p-4 sm:p-6"
        aria-label="Saglayout #2 mockup"
      >
        <div className="portal-v2-card flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-muted-foreground text-[12px]">
              Sager / {MOCK.ticketNumber}
            </p>
            <h2 className="text-star-navy text-lg font-bold sm:text-xl">
              {MOCK.ticketNumber} · {MOCK.title}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{MOCK.status}</Badge>
              <Badge variant="outline">Kilde: {MOCK.source}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline">
              Tildel
            </Button>
            <Button size="sm" variant="outline">
              Løs
            </Button>
            <Button size="sm">Skriv opdatering</Button>
          </div>
        </div>

        <div className="portal-v2-card px-4 py-3 sm:px-5">
          <ol className="flex flex-wrap gap-4 text-[11px] sm:gap-8">
            {["Oprettet", "Tildelt", "I arbejde", "Løst", "Lukket"].map((step, i) => (
              <li
                key={step}
                className={cn(
                  "font-medium",
                  i === 2 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="portal-v2-card p-4 sm:p-5">
              <h3 className="portal-v2-section-title mb-2">Beskrivelse</h3>
              <p className="text-[14px] whitespace-pre-wrap">{MOCK.description}</p>
            </section>

            <section className="portal-v2-card border-star-navy/15 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="text-star-navy size-4" aria-hidden />
                <h3 className="portal-v2-section-title">Vidensartikler & flet</h3>
              </div>
              <p className="text-muted-foreground mb-3 text-[12px]">
                Artikler linket til sagen. Flet-felter i artikeltekst peger tilbage på{" "}
                <code className="text-[11px]">{buildMergeField("sag", MOCK.ticketNumber)}</code>.
              </p>

              <ul className="space-y-3">
                {MOCK.linkedArticles.map((article) => (
                  <li
                    key={article.id}
                    className="border-border rounded-[2px] border bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/knowledge/${article.id}`}
                        className="text-primary text-[13px] font-semibold hover:underline"
                      >
                        {article.number} — {article.title}
                      </Link>
                      <Badge variant="outline" className="text-[10px]">
                        {article.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-[12px] leading-relaxed">
                      <KnowledgeMergeFieldText
                        text={article.excerpt}
                        resolveLink={(kind, ref) =>
                          kind === "sag"
                            ? {
                                href: `/tickets/${MOCK.ticketId}`,
                                label: ref,
                              }
                            : {
                                href: `/knowledge/${ref === "KB-2024-00012" ? "kb-2" : "kb-1"}`,
                                label: ref,
                              }
                        }
                      />
                    </p>
                  </li>
                ))}
              </ul>

              <div className="border-border mt-4 border-t pt-3">
                <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wide">
                  AI-forslag
                </p>
                <ul className="space-y-1.5">
                  {MOCK.suggestedArticles.map((s) => (
                    <li key={s.number}>
                      <button
                        type="button"
                        className="text-primary flex w-full items-center gap-1 text-left text-[12px] hover:underline"
                      >
                        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                        {s.number} — {s.title}
                        <span className="text-muted-foreground ml-auto text-[10px]">
                          {s.score}% match
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="portal-v2-card overflow-hidden p-0">
              <div
                className="border-border flex border-b"
                role="tablist"
                aria-label="Sagindhold"
              >
                {(
                  [
                    ["beskeder", "Beskeder", MessageSquare],
                    ["email", "E-mail", Link2],
                    ["handlinger", "Handlinger", Sparkles],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition-colors",
                      tab === id
                        ? "border-primary text-primary border-b-2 bg-white"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                    onClick={() => setTab(id)}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-5" role="tabpanel">
                {tab === "beskeder" ? (
                  <ul className="space-y-3">
                    {MOCK.comments.map((c) => (
                      <li key={c.id} className="border-border rounded-[2px] border p-3">
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-semibold">{c.author}</span>
                          {c.external ? (
                            <Badge variant="outline" className="text-[10px]">
                              Ekstern
                            </Badge>
                          ) : null}
                          <span className="text-muted-foreground">{c.at}</span>
                        </div>
                        <p className="text-[13px]">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {tab === "email" ? (
                  <p className="text-muted-foreground text-[13px]">
                    E-mail-tråd samlet her — ikke i hovedscroll. Ingen Gmail-tråd på denne sag
                    endnu.
                  </p>
                ) : null}
                {tab === "handlinger" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      Push til Slack
                    </Button>
                    <Button size="sm" variant="outline">
                      Opret vidensartikel (kladde)
                    </Button>
                    <Button size="sm">Udgiv på portal</Button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:col-span-1">
            <section className="portal-v2-card p-4 sm:p-5 lg:sticky lg:top-4">
              <h3 className="portal-v2-section-title mb-3">Detaljer</h3>
              <dl className="space-y-1.5 text-[12px]">
                {[
                  ["Kategori", MOCK.category],
                  ["Underkategori", MOCK.subcategory],
                  ["Team", MOCK.team],
                  ["Sagsbehandler", MOCK.assignee],
                  ["Prioritet", MOCK.priority],
                  ["Indmelder", MOCK.reporter],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-border py-1.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-destructive/40 bg-destructive/5 mt-3 rounded-[2px] border p-2.5">
                <p className="text-destructive text-[11px] font-bold">{MOCK.slaLabel}</p>
                <p className="text-destructive/90 text-[11px]">{MOCK.slaDetail}</p>
              </div>
            </section>

            <section className="portal-v2-card p-4 sm:p-5">
              <h3 className="portal-v2-section-title mb-1">Billeder</h3>
              <p className="text-muted-foreground mb-3 text-[11px]">
                Vertikal liste uden for beskeder — navngivet med sagsnummer og tid.
              </p>
              <ul className="space-y-2">
                {MOCK.images.map((img) => (
                  <li key={img.id}>
                    <MockImageThumb label={img.label} at={img.at} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="portal-v2-card p-4 sm:p-5">
              <h3 className="portal-v2-section-title mb-2">Flet på artiklen</h3>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                I vidensartikel under «Relaterede emner» gemmes fx:
              </p>
              <code className="bg-muted mt-2 block rounded-[2px] p-2 text-[10px] leading-relaxed break-all">
                Kildesag: {buildMergeField("sag", MOCK.ticketNumber)}
                {" · "}
                Relateret: {buildMergeField("kb", "KB-2024-00012")}
              </code>
              <Link
                href="/knowledge"
                className="text-primary mt-2 inline-block text-[12px] font-medium hover:underline"
              >
                Åbn vidensartikler →
              </Link>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
