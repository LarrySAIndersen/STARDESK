import { definitionForKind, nextWidgetOrder } from "@/lib/workspace-landing/catalog";
import type {
  WorkspaceLandingConfig,
  WorkspaceSpace,
  WorkspaceWidgetInstance,
  WorkspaceWidgetKind,
} from "@/lib/workspace-landing/types";

export function parseWorkspaceSpace(value: string | null): WorkspaceSpace {
  return value === "team" ? "team" : "personal";
}

export function reorderWidgetInstances(
  instances: WorkspaceWidgetInstance[],
): WorkspaceWidgetInstance[] {
  return instances
    .filter((item) => !item.hidden)
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }));
}

export function visibleWidgetInstances(
  instances: WorkspaceWidgetInstance[],
): WorkspaceWidgetInstance[] {
  return instances.filter((item) => !item.hidden).sort((a, b) => a.order - b.order);
}

export function moveWidgetInstance(
  items: WorkspaceWidgetInstance[],
  instanceId: string,
  direction: -1 | 1,
): WorkspaceWidgetInstance[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((item) => item.instanceId === instanceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) {
    return items;
  }
  const next = [...sorted];
  const temp = next[index].order;
  next[index] = { ...next[index], order: next[target].order };
  next[target] = { ...next[target], order: temp };
  return next;
}

export function toggleWidgetSpan(
  items: WorkspaceWidgetInstance[],
  instanceId: string,
): WorkspaceWidgetInstance[] {
  return items.map((item) =>
    item.instanceId === instanceId
      ? { ...item, span: item.span === "full" ? "half" : "full" }
      : item,
  );
}

export function hideWidgetInstance(
  items: WorkspaceWidgetInstance[],
  instanceId: string,
): WorkspaceWidgetInstance[] {
  return items.map((item) =>
    item.instanceId === instanceId ? { ...item, hidden: true } : item,
  );
}

export function createWidgetInstance(
  kind: WorkspaceWidgetKind,
  items: WorkspaceWidgetInstance[],
  instanceSuffix = String(Date.now()),
): WorkspaceWidgetInstance {
  const def = definitionForKind(kind);
  return {
    instanceId: `${kind}-${instanceSuffix}`,
    kind,
    order: nextWidgetOrder(items),
    span: def.defaultSpan,
    hidden: false,
  };
}

export function applySpaceWidgetUpdate(
  config: WorkspaceLandingConfig,
  spaceKey: WorkspaceSpace,
  updater: (items: WorkspaceWidgetInstance[]) => WorkspaceWidgetInstance[],
): WorkspaceLandingConfig {
  return {
    ...config,
    [spaceKey]: reorderWidgetInstances(updater(config[spaceKey])),
  };
}

export function buildSpaceHref(space: WorkspaceSpace, searchParams: string): string {
  const params = new URLSearchParams(searchParams);
  params.set("space", space);
  return `/?${params.toString()}`;
}

export function needsPostItProvider(widgets: WorkspaceWidgetInstance[]): boolean {
  return widgets.some((w) => w.kind === "personal-notes" || w.kind === "personal-kanban");
}
