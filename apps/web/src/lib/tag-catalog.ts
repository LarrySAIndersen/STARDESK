import { apiGet } from "@/lib/api";

export type TagCatalogEntry = {
  slug: string;
  label_da: string;
  category: string;
  keywords: string[];
  synonyms: string[];
  auto_suggest: boolean;
  description_da: string | null;
  usage_count: number | null;
};

export type TagSuggestion = {
  slug: string;
  label_da: string;
  confidence: number;
  source: "catalog_keyword" | "catalog_rule" | "llm" | "manual" | string;
  reason_da: string | null;
};

export type SimilarTicket = {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  score: number;
  match_reasons: string[];
  tags: string[];
};

let catalogCache: TagCatalogEntry[] | null = null;

export async function fetchTagCatalog(options?: {
  includeUsage?: boolean;
}): Promise<TagCatalogEntry[]> {
  const includeUsage = options?.includeUsage ?? true;
  if (catalogCache && includeUsage) {
    return catalogCache;
  }
  const entries = await apiGet<TagCatalogEntry[]>(
    `/api/v1/tags?include_usage=${includeUsage ? "true" : "false"}`,
  );
  if (includeUsage) {
    catalogCache = entries;
  }
  return entries;
}

export async function suggestTagsFromText(text: string): Promise<{
  suggestions: TagSuggestion[];
  suggested_slugs: string[];
}> {
  const params = new URLSearchParams({ text });
  return apiGet(`/api/v1/tags/suggest?${params.toString()}`);
}

export async function fetchSimilarTickets(
  ticketId: string,
  options?: { closedOnly?: boolean; limit?: number },
): Promise<SimilarTicket[]> {
  const params = new URLSearchParams();
  if (options?.closedOnly) {
    params.set("closed_only", "true");
  }
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  const qs = params.toString();
  return apiGet<SimilarTicket[]>(
    `/api/v1/tickets/${ticketId}/similar${qs ? `?${qs}` : ""}`,
  );
}

export function formatCatalogOption(entry: TagCatalogEntry): string {
  const usage =
    entry.usage_count != null && entry.usage_count > 0
      ? ` (${entry.usage_count})`
      : "";
  return `${entry.label_da}${usage}`;
}
