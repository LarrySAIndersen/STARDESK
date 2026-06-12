import { describe, expect, it } from "vitest";

import {
  MERGE_FIELD_HELP_DA,
  buildMergeField,
  knowledgeHrefForRef,
  parseMergeFields,
  ticketHrefForNumber,
} from "./knowledge-merge-fields";

describe("parseMergeFields", () => {
  it("extracts sag and kb merge tokens", () => {
    const text = "Se {{sag:INC-2026-00087}} og {{kb:KB-2024-00001}} for detaljer.";
    const fields = parseMergeFields(text);
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ kind: "sag", ref: "INC-2026-00087" });
    expect(fields[1]).toMatchObject({ kind: "kb", ref: "KB-2024-00001" });
  });

  it("skips empty refs", () => {
    expect(parseMergeFields("{{sag:}}")).toEqual([]);
  });
});

describe("buildMergeField", () => {
  it("builds trimmed merge token", () => {
    expect(buildMergeField("kb", " KB-1 ")).toBe("{{kb:KB-1}}");
  });
});

describe("href helpers", () => {
  it("builds ticket href with id or search fallback", () => {
    expect(ticketHrefForNumber("INC-1", "ticket-id")).toBe("/tickets/ticket-id");
    expect(ticketHrefForNumber("INC-1")).toBe("/tickets?search=INC-1");
  });

  it("builds knowledge href with id or search fallback", () => {
    expect(knowledgeHrefForRef("KB-1", "article-id")).toBe("/knowledge/article-id");
    expect(knowledgeHrefForRef("KB-1")).toBe("/knowledge?search=KB-1");
  });
});

describe("MERGE_FIELD_HELP_DA", () => {
  it("documents merge field syntax in Danish", () => {
    expect(MERGE_FIELD_HELP_DA).toContain("{{sag:");
  });
});
