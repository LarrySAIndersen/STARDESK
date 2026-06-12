import { describe, expect, it } from "vitest";

import { WORKSPACE_WIDGET_CATALOG } from "@/lib/workspace-landing/catalog";
import {
  WORKSPACE_LAYOUT_TABLE,
  WORKSPACE_WIDGET_INSTANCE_FIELDS,
  WIDGET_DATABASE_SOURCES,
  databaseSourceForKind,
} from "@/lib/workspace-landing/datamodel";

describe("workspace landing datamodel", () => {
  it("documents the layout table and JSONB widget fields", () => {
    expect(WORKSPACE_LAYOUT_TABLE.name).toBe("user_workspace_layouts");
    expect(WORKSPACE_LAYOUT_TABLE.columns.some((col) => col.name === "layout")).toBe(true);
    expect(WORKSPACE_WIDGET_INSTANCE_FIELDS.map((field) => field.name)).toContain("instance_id");
  });

  it("maps every catalog widget to database sources", () => {
    for (const widget of WORKSPACE_WIDGET_CATALOG) {
      const source = databaseSourceForKind(widget.kind);
      expect(source.tables.length).toBeGreaterThan(0);
      expect(source.idField.length).toBeGreaterThan(0);
      expect(WIDGET_DATABASE_SOURCES[widget.kind]).toBe(source);
    }
  });
});
