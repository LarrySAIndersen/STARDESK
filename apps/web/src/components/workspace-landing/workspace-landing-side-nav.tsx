"use client";

import Link from "next/link";
import { LayoutGrid, Map } from "lucide-react";

import { definitionForKind } from "@/lib/workspace-landing/catalog";
import {
  buildWorkspaceHref,
  visibleWidgetInstances,
  WORKSPACE_SITEMAP_PATH,
  type WorkspaceLandingView,
} from "@/lib/workspace-landing/layout-utils";
import type { WorkspaceSpace, WorkspaceWidgetInstance } from "@/lib/workspace-landing/types";
import { cn } from "@/lib/utils";

type WorkspaceLandingSideNavProps = Readonly<{
  space: WorkspaceSpace;
  view: WorkspaceLandingView;
  widgets: WorkspaceWidgetInstance[];
  activeWidgetId?: string | null;
  searchParams: string;
}>;

export function WorkspaceLandingSideNav({
  space,
  view,
  widgets,
  activeWidgetId,
  searchParams,
}: WorkspaceLandingSideNavProps) {
  const visibleWidgets = visibleWidgetInstances(widgets);
  const gridHref = buildWorkspaceHref({ space, view: "grid", preserveParams: searchParams });

  return (
    <nav className="workspace-landing-side-nav" aria-label="Arbejdsrum navigation">
      <p className="workspace-landing-side-nav__heading">Navigation</p>
      <ul className="workspace-landing-side-nav__list">
        <li>
          <Link
            href={gridHref}
            className={cn(
              "workspace-landing-side-nav__link",
              view === "grid" && "workspace-landing-side-nav__link--active",
            )}
            aria-current={view === "grid" ? "page" : undefined}
          >
            <LayoutGrid className="size-4 shrink-0 opacity-70" aria-hidden />
            Overblik
          </Link>
        </li>
        <li>
          <Link
            href={WORKSPACE_SITEMAP_PATH}
            className={cn(
              "workspace-landing-side-nav__link",
              view === "sitemap" && "workspace-landing-side-nav__link--active",
            )}
            aria-current={view === "sitemap" ? "page" : undefined}
          >
            <Map className="size-4 shrink-0 opacity-70" aria-hidden />
            Sitemap
          </Link>
        </li>
      </ul>

      {visibleWidgets.length > 0 ? (
        <>
          <p className="workspace-landing-side-nav__heading">
            {space === "team" ? "Team-elementer" : "Dine elementer"}
          </p>
          <ul className="workspace-landing-side-nav__list">
            {visibleWidgets.map((instance) => {
              const definition = definitionForKind(instance.kind);
              const href = buildWorkspaceHref({
                space,
                view: "widget",
                widgetInstanceId: instance.instanceId,
                preserveParams: searchParams,
              });
              const isActive = view === "widget" && activeWidgetId === instance.instanceId;

              return (
                <li key={instance.instanceId}>
                  <Link
                    href={href}
                    className={cn(
                      "workspace-landing-side-nav__link workspace-landing-side-nav__link--widget",
                      isActive && "workspace-landing-side-nav__link--active",
                    )}
                    aria-current={isActive ? "page" : undefined}
                    title={definition.description}
                  >
                    {definition.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </nav>
  );
}
