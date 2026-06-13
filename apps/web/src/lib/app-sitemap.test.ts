import { describe, expect, it } from "vitest";

import {
  buildAppSitemapSections,
  filterAppSitemapSections,
  isExternalNavHref,
  navIconForItemId,
} from "@/lib/app-sitemap";
import type { User } from "@/types/user";

function makeUser(role: User["role"]): User {
  return {
    id: "u1",
    email: "agent@example.dk",
    display_name: "Anna Agent",
    role,
    role_label: role,
    roles: [role],
  };
}

describe("buildAppSitemapSections", () => {
  it("includes staff routes for agents", () => {
    const sections = buildAppSitemapSections(makeUser("agent"), []);
    const allLabels = sections.flatMap((section) => section.items.map((item) => item.label));
    expect(allLabels).toContain("Service Desk");
    expect(allLabels).toContain("Projektoversigt");
    expect(allLabels).toContain("Arbejdsrum overblik");
    expect(allLabels).toContain("Systemdokumentation");
    expect(allLabels).not.toContain("Brugere");
  });

  it("includes admin routes for administrators", () => {
    const sections = buildAppSitemapSections(makeUser("admin"), []);
    const allLabels = sections.flatMap((section) => section.items.map((item) => item.label));
    expect(allLabels).toContain("Brugere");
    expect(allLabels).toContain("Admin dashboard");
  });

  it("limits end users to self-service routes", () => {
    const sections = buildAppSitemapSections(makeUser("end_user"), []);
    const allLabels = sections.flatMap((section) => section.items.map((item) => item.label));
    expect(allLabels).toContain("Alle sager");
    expect(allLabels).toContain("Selvbetjeningsportal");
    expect(allLabels).not.toContain("Service Desk");
    expect(allLabels).not.toContain("Arbejdsrum overblik");
  });

  it("hides arbejdsrum for non-topadmin when eye marks it hidden", () => {
    const sections = buildAppSitemapSections(makeUser("agent"), ["arbejdsrum"]);
    const allLabels = sections.flatMap((section) => section.items.map((item) => item.label));
    expect(allLabels).not.toContain("Arbejdsrum overblik");
  });
});

describe("filterAppSitemapSections", () => {
  const sections = buildAppSitemapSections(makeUser("agent"), []);

  it("returns all sections when query is empty", () => {
    expect(filterAppSitemapSections(sections, "")).toEqual(sections);
  });

  it("filters by label", () => {
    const filtered = filterAppSitemapSections(sections, "kanban");
    const labels = filtered.flatMap((section) => section.items.map((item) => item.label));
    expect(labels).toEqual(["Kanban"]);
  });
});

describe("navIconForItemId", () => {
  it("returns icons for known nav ids", () => {
    expect(navIconForItemId("tickets")).toBeDefined();
    expect(navIconForItemId("unknown-id")).toBeDefined();
  });
});
