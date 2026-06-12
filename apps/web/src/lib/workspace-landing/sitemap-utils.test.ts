import { describe, expect, it } from "vitest";

import { DEFAULT_WORKSPACE_LANDING } from "@/lib/workspace-landing/catalog";
import {
  buildSitemapEntries,
  filterSitemapEntries,
  normalizeSitemapSearch,
  sitemapEntryMatchesSearch,
} from "@/lib/workspace-landing/sitemap-utils";

describe("sitemap utils", () => {
  it("normalizes search input", () => {
    expect(normalizeSitemapSearch("  Chat  ")).toBe("chat");
  });

  it("builds personal and team entries with active flags", () => {
    const personal = buildSitemapEntries("personal", DEFAULT_WORKSPACE_LANDING.personal);
    expect(personal.every((entry) => entry.space === "personal")).toBe(true);
    expect(personal.some((entry) => entry.active)).toBe(true);

    const team = buildSitemapEntries("team", DEFAULT_WORKSPACE_LANDING.team);
    expect(team.every((entry) => entry.space === "team")).toBe(true);
  });

  it("matches entries by label, description, and kind", () => {
    const entries = buildSitemapEntries("team", DEFAULT_WORKSPACE_LANDING.team);
    const chatEntry = entries.find((entry) => entry.kind === "team-chat");
    expect(chatEntry).toBeDefined();
    expect(sitemapEntryMatchesSearch(chatEntry!, "teamchat")).toBe(true);
    expect(sitemapEntryMatchesSearch(chatEntry!, "unknown-widget")).toBe(false);
  });

  it("filters by query and status", () => {
    const entries = buildSitemapEntries("personal", DEFAULT_WORKSPACE_LANDING.personal);
    const activeOnly = filterSitemapEntries(entries, "", "active");
    expect(activeOnly.every((entry) => entry.active)).toBe(true);

    const chatMatches = filterSitemapEntries(entries, "kanban", "all");
    expect(chatMatches.some((entry) => entry.kind === "personal-kanban")).toBe(true);
  });
});
