import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet } from "@/lib/api";
import {
  fetchSimilarTickets,
  fetchTagCatalog,
  formatCatalogOption,
  suggestTagsFromText,
  type TagCatalogEntry,
} from "@/lib/tag-catalog";

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
}));

const apiGetMock = vi.mocked(apiGet);

const sampleEntry: TagCatalogEntry = {
  slug: "vpn",
  label_da: "VPN",
  category: "network",
  keywords: ["vpn"],
  synonyms: [],
  auto_suggest: true,
  description_da: null,
  usage_count: 3,
};

describe("formatCatalogOption", () => {
  it("includes usage count when present", () => {
    expect(formatCatalogOption(sampleEntry)).toBe("VPN (3)");
  });

  it("omits usage suffix when count is zero or missing", () => {
    expect(formatCatalogOption({ ...sampleEntry, usage_count: 0 })).toBe("VPN");
    expect(formatCatalogOption({ ...sampleEntry, usage_count: null })).toBe("VPN");
  });
});

describe("fetchTagCatalog", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("requests catalog with usage by default", async () => {
    apiGetMock.mockResolvedValue([sampleEntry]);
    const entries = await fetchTagCatalog();
    expect(entries).toEqual([sampleEntry]);
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/tags?include_usage=true");
  });

  it("can skip usage and bypass cache", async () => {
    apiGetMock.mockResolvedValue([{ ...sampleEntry, usage_count: null }]);
    await fetchTagCatalog({ includeUsage: false });
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/tags?include_usage=false");
  });
});

describe("suggestTagsFromText", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("calls suggest endpoint with encoded text", async () => {
    apiGetMock.mockResolvedValue({
      suggestions: [],
      suggested_slugs: ["printer"],
    });
    const result = await suggestTagsFromText("Printer fejl");
    expect(result.suggested_slugs).toEqual(["printer"]);
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/tags/suggest?text=Printer+fejl",
    );
  });
});

describe("fetchSimilarTickets", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
  });

  it("builds query string for closed-only and limit", async () => {
    apiGetMock.mockResolvedValue([]);
    await fetchSimilarTickets("ticket-1", { closedOnly: true, limit: 5 });
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/tickets/ticket-1/similar?closed_only=true&limit=5",
    );
  });

  it("omits query string when no options", async () => {
    apiGetMock.mockResolvedValue([]);
    await fetchSimilarTickets("ticket-2");
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/tickets/ticket-2/similar");
  });
});
