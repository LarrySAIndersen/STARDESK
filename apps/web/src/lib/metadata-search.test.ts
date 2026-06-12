import { describe, expect, it } from "vitest";

import {
  METADATA_FIELD_CHANGE_REASON,
  filterCategoriesForSearch,
  filterPrioritiesForSearch,
  filterSourcesForSearch,
  filterStatusesForSearch,
  filterSubcategoriesForSearch,
  filterTicketTypesForSearch,
} from "./metadata-search";
import type { Category, Subcategory } from "@/types/category";

const categories: Category[] = [
  {
    id: "c1",
    name: "Network",
    name_da: "Netværk",
    subcategories: [],
  },
  {
    id: "c2",
    name: "Hardware",
    name_da: "Hardware",
    subcategories: [],
  },
];

const subcategories: Subcategory[] = [
  { id: "s1", name: "Printer", name_da: "Printer" },
  { id: "s2", name: "PC", name_da: "Computer" },
];

describe("filterCategoriesForSearch", () => {
  it("filters categories by Danish name", () => {
    expect(filterCategoriesForSearch(categories, "net")).toEqual([
      { id: "c1", label: "Netværk" },
    ]);
    expect(filterCategoriesForSearch(categories, "")).toHaveLength(2);
  });
});

describe("filterSubcategoriesForSearch", () => {
  it("filters subcategories by Danish name", () => {
    expect(filterSubcategoriesForSearch(subcategories, "print")).toEqual([
      { id: "s1", label: "Printer" },
    ]);
  });
});

describe("metadata enum filters", () => {
  it("filters statuses by Danish label", () => {
    const options = filterStatusesForSearch("luk");
    expect(options.some((o) => o.id === "closed")).toBe(true);
  });

  it("filters priorities by Danish label", () => {
    expect(filterPrioritiesForSearch("krit")).toEqual([
      { id: "critical", label: "Kritisk" },
    ]);
  });

  it("filters ticket types by Danish label", () => {
    expect(filterTicketTypesForSearch("hænd")).toEqual([
      { id: "incident", label: "Hændelse" },
    ]);
  });

  it("filters sources by Danish label", () => {
    expect(filterSourcesForSearch("selv")).toEqual([
      { id: "portal", label: "Selvbetjening" },
    ]);
  });
});

describe("METADATA_FIELD_CHANGE_REASON", () => {
  it("is Danish copy for metadata panel edits", () => {
    expect(METADATA_FIELD_CHANGE_REASON).toContain("metadata");
  });
});
