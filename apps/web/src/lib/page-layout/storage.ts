import type { PageLayoutFieldConfig, PageLayoutPageConfig } from "@/lib/page-layout/types";

const STORAGE_PREFIX = "stardesk-page-layout:v1:";

export const PAGE_LAYOUT_CHANGED_EVENT = "stardesk-page-layout-changed";

export function pageLayoutKey(pathname: string): string {
  return pathname
    .replace(/\/tickets\/[^/]+/g, "/tickets/[id]")
    .replace(/\/kanban\/[^/]+/g, "/kanban/[boardId]")
    .replace(/\/users\/[^/]+/g, "/users/[id]")
    .replace(/\/aktiver\/[^/]+/g, "/aktiver/[id]")
    .replace(/\/knowledge\/[^/]+/g, "/knowledge/[id]");
}

export function readPageLayout(pageKey: string): PageLayoutPageConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${pageKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as PageLayoutPageConfig;
  } catch {
    return null;
  }
}

export function writePageLayout(pageKey: string, config: PageLayoutPageConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${pageKey}`, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(PAGE_LAYOUT_CHANGED_EVENT, { detail: { pageKey } }));
}

export function mergeFieldConfig(
  saved: PageLayoutPageConfig | null,
  fieldId: string,
  defaults: { label: string; order: number; span: PageLayoutFieldConfig["span"] },
): PageLayoutFieldConfig {
  const fromSaved = saved?.fields[fieldId];
  if (!fromSaved) {
    return {
      label: defaults.label,
      order: defaults.order,
      span: defaults.span,
      collapsed: false,
    };
  }
  return {
    label: fromSaved.label || defaults.label,
    order: typeof fromSaved.order === "number" ? fromSaved.order : defaults.order,
    span: fromSaved.span === "half" ? "half" : "full",
    collapsed: Boolean(fromSaved.collapsed),
  };
}

export function upsertField(
  config: PageLayoutPageConfig,
  fieldId: string,
  patch: Partial<PageLayoutFieldConfig>,
): PageLayoutPageConfig {
  const current = config.fields[fieldId] ?? {
    label: fieldId,
    order: 0,
    span: "full" as const,
    collapsed: false,
  };
  return {
    fields: {
      ...config.fields,
      [fieldId]: { ...current, ...patch },
    },
  };
}
