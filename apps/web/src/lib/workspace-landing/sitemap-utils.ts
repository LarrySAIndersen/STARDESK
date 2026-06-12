import { WORKSPACE_WIDGET_CATALOG } from "@/lib/workspace-landing/catalog";
import { visibleWidgetInstances } from "@/lib/workspace-landing/layout-utils";
import type {
  WorkspaceSpace,
  WorkspaceWidgetDefinition,
  WorkspaceWidgetInstance,
} from "@/lib/workspace-landing/types";

export type SitemapEntry = WorkspaceWidgetDefinition & {
  instance: WorkspaceWidgetInstance | undefined;
  active: boolean;
};

export type SitemapStatusFilter = "all" | "active" | "inactive";

export function normalizeSitemapSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function sitemapEntryMatchesSearch(entry: SitemapEntry, query: string): boolean {
  if (!query) return true;
  return (
    entry.label.toLowerCase().includes(query) ||
    entry.description.toLowerCase().includes(query) ||
    entry.kind.toLowerCase().includes(query)
  );
}

export function buildSitemapEntries(
  spaceKey: WorkspaceSpace,
  instances: WorkspaceWidgetInstance[],
): SitemapEntry[] {
  const visible = visibleWidgetInstances(instances);
  return WORKSPACE_WIDGET_CATALOG.filter((item) => item.space === spaceKey).map((definition) => {
    const instance = visible.find((item) => item.kind === definition.kind);
    return { ...definition, instance, active: Boolean(instance) };
  });
}

export function filterSitemapEntries(
  entries: SitemapEntry[],
  query: string,
  statusFilter: SitemapStatusFilter,
): SitemapEntry[] {
  const normalizedQuery = normalizeSitemapSearch(query);
  return entries.filter((entry) => {
    if (!sitemapEntryMatchesSearch(entry, normalizedQuery)) return false;
    if (statusFilter === "active" && !entry.active) return false;
    if (statusFilter === "inactive" && entry.active) return false;
    return true;
  });
}
