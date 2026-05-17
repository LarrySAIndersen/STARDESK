export function parseTagsInput(value: string): string[] {
  if (!value.trim()) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of value.split(/[,;]+/)) {
    const tag = part.trim().toLowerCase();
    if (!tag || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    result.push(tag);
    if (result.length >= 10) {
      break;
    }
  }
  return result;
}

export function formatTagsForInput(tags: string[] | undefined): string {
  return (tags ?? []).join(", ");
}

export function ticketMatchesSearch(
  ticket: {
    title: string;
    ticket_number: string;
    tags?: string[];
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  if (ticket.title.toLowerCase().includes(q)) {
    return true;
  }
  if (ticket.ticket_number.toLowerCase().includes(q)) {
    return true;
  }
  return (ticket.tags ?? []).some((tag) => tag.includes(q));
}
