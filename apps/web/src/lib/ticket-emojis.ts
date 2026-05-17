export type TicketEmojiOption = {
  emoji: string;
  label: string;
  hint: string;
};

/** Curated emoji set — keep in sync with API ALLOWED_TICKET_EMOJIS */
export const TICKET_EMOJI_OPTIONS: TicketEmojiOption[] = [
  { emoji: "🔥", label: "Kritisk / brændende", hint: "Haster" },
  { emoji: "⚠️", label: "Advarsel", hint: "Risiko eller fejl" },
  { emoji: "🛠️", label: "Reparation", hint: "Fejlrettelse" },
  { emoji: "💻", label: "IT / system", hint: "Applikation eller PC" },
  { emoji: "📞", label: "Kontakt", hint: "Opkald eller support" },
  { emoji: "🔒", label: "Sikkerhed", hint: "Adgang eller GDPR" },
  { emoji: "📎", label: "Dokumentation", hint: "Vedhæftning eller reference" },
  { emoji: "✅", label: "Klar / OK", hint: "Afventer lukning" },
  { emoji: "🚀", label: "Udrulning", hint: "Release eller change" },
  { emoji: "❓", label: "Afklaring", hint: "Mangler information" },
];

export const ALLOWED_TICKET_EMOJIS = new Set(
  TICKET_EMOJI_OPTIONS.map((option) => option.emoji),
);
