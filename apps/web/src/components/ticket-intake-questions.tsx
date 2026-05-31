"use client";

import { useMemo } from "react";

export type IntakeAnswers = Record<string, string>;

const VPN_PATTERN = /\bvpn\b|hjemmefra|remote|fjern/i;
const DEVICE_PATTERN = /\blaptop|pc|mobil|telefon|printer|enhed\b/i;
const URGENCY_PATTERN = /\bmøde|deadline|akut|straks|kritisk|haster\b/i;

type IntakeQuestion = Readonly<{
  id: string;
  label: string;
  hint: string;
  options: { value: string; label: string }[];
}>;

const ALL_QUESTIONS: IntakeQuestion[] = [
  {
    id: "vpn_remote",
    label: "Arbejder du hjemmefra / via VPN?",
    hint: "Hjælper netværksteamet med at prioritere.",
    options: [
      { value: "", label: "— Vælg (valgfrit) —" },
      { value: "ja", label: "Ja" },
      { value: "nej", label: "Nej" },
      { value: "ved_ikke", label: "Ved ikke" },
    ],
  },
  {
    id: "device_type",
    label: "Hvilken enhed gælder det?",
    hint: "Fx laptop, mobil eller printer.",
    options: [
      { value: "", label: "— Vælg (valgfrit) —" },
      { value: "laptop", label: "Laptop / PC" },
      { value: "mobil", label: "Mobil / tablet" },
      { value: "printer", label: "Printer" },
      { value: "andet", label: "Andet" },
    ],
  },
  {
    id: "urgency",
    label: "Er der møde eller deadline snart?",
    hint: "Bruges til foreslået prioritet — ændrer ikke din valgte prioritet automatisk.",
    options: [
      { value: "", label: "— Vælg (valgfrit) —" },
      { value: "møde_snart", label: "Ja — møde/deadline inden for få timer" },
      { value: "normal", label: "Nej — normal hastighed" },
      { value: "kan_vente", label: "Kan vente" },
    ],
  },
];

function pickQuestions(title: string, description: string, categoryName?: string): IntakeQuestion[] {
  const blob = `${title} ${description} ${categoryName ?? ""}`;
  const picked: IntakeQuestion[] = [];
  if (VPN_PATTERN.test(blob)) {
    picked.push(ALL_QUESTIONS[0]!);
  }
  if (DEVICE_PATTERN.test(blob) || picked.length === 0) {
    picked.push(ALL_QUESTIONS[1]!);
  }
  if (URGENCY_PATTERN.test(blob) || picked.length < 2) {
    picked.push(ALL_QUESTIONS[2]!);
  }
  const seen = new Set<string>();
  return picked
    .filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    })
    .slice(0, 3);
}

export function TicketIntakeQuestions({
  title,
  description,
  categoryName,
  answers,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  categoryName?: string;
  answers: IntakeAnswers;
  onChange: (next: IntakeAnswers) => void;
  disabled?: boolean;
}) {
  const questions = useMemo(
    () => pickQuestions(title, description, categoryName),
    [title, description, categoryName],
  );

  if (questions.length === 0) {
    return null;
  }

  return (
    <section
      className="space-y-4 rounded-[2px] border border-[var(--gray-border)] bg-[var(--gray-bg)] p-4"
      aria-labelledby="intake-questions-heading"
    >
      <div>
        <h2 id="intake-questions-heading" className="wire-card-title text-base">
          Hurtige afklaringer
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          Valgfrit — gør sagen klar til auto-tildeling (anbefales).
        </p>
      </div>

      {questions.map((q) => (
        <div key={q.id} className="space-y-1">
          <label className="wire-form-label" htmlFor={`intake-${q.id}`}>
            {q.label}
          </label>
          <select
            id={`intake-${q.id}`}
            className="wire-form-input h-9"
            disabled={disabled}
            value={answers[q.id] ?? ""}
            onChange={(e) => onChange({ ...answers, [q.id]: e.target.value })}
          >
            {q.options.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">{q.hint}</p>
        </div>
      ))}
    </section>
  );
}
