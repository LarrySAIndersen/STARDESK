/** Danish label for `tickets.source` (fallback if API did not send `source_label_da`). */
const TICKET_SOURCE_LABELS_DA: Record<string, string> = {
  email: "E-mail",
  phone: "Telefon",
  chat: "Chat",
  portal: "Selvbetjening",
  api: "API",
  knowledge: "Vidensartikel",
};

export function ticketSourceLabelDa(source: string | null | undefined): string {
  if (!source) {
    return "Andet";
  }
  return TICKET_SOURCE_LABELS_DA[source] ?? "Andet";
}
