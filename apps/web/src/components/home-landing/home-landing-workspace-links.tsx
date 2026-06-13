"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, LayoutGrid } from "lucide-react";

import { definitionForKind } from "@/lib/workspace-landing/catalog";
import {
  buildWorkspaceHref,
  visibleWidgetInstances,
} from "@/lib/workspace-landing/layout-utils";
import { visualForKind } from "@/lib/workspace-landing/sitemap-visuals";
import {
  readWorkspaceLanding,
  WORKSPACE_LANDING_CHANGED_EVENT,
} from "@/lib/workspace-landing/storage";
import type { WorkspaceSpace } from "@/lib/workspace-landing/types";
import { cn } from "@/lib/utils";

const SPACE_TABS: ReadonlyArray<{
  id: WorkspaceSpace;
  label: string;
  hint: string;
}> = [
  {
    id: "personal",
    label: "Eget space",
    hint: "Dit personlige overblik — dashboard, noter og sager.",
  },
  {
    id: "team",
    label: "Team space",
    hint: "Fælles team-overblik — chat, KPI'er og kø.",
  },
];

export function HomeLandingWorkspaceLinks({
  userId,
  displayName,
}: Readonly<{
  userId: string;
  displayName: string;
}>) {
  const [space, setSpace] = useState<WorkspaceSpace>("personal");
  const [layout, setLayout] = useState(() => readWorkspaceLanding(userId));

  useEffect(() => {
    function refresh() {
      setLayout(readWorkspaceLanding(userId));
    }

    window.addEventListener(WORKSPACE_LANDING_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(WORKSPACE_LANDING_CHANGED_EVENT, refresh);
  }, [userId]);

  const widgets = useMemo(
    () => visibleWidgetInstances(layout[space]),
    [layout, space],
  );

  const activeTab = SPACE_TABS.find((tab) => tab.id === space) ?? SPACE_TABS[0];
  const overviewHref = buildWorkspaceHref({ space, view: "grid" });

  return (
    <div className="home-landing__units">
      <div className="home-landing__units-toolbar">
        <div className="home-landing__units-tabs" role="tablist" aria-label="Arbejdsrum space">
          {SPACE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={space === tab.id}
              className={cn(
                "home-landing__units-tab",
                space === tab.id && "home-landing__units-tab--active",
              )}
              onClick={() => setSpace(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link href={overviewHref} className="home-landing__units-overview">
          <LayoutGrid className="size-4 shrink-0 opacity-70" aria-hidden />
          Overblik
          <ArrowUpRight className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Link>
      </div>

      <p className="home-landing__units-hint">{activeTab.hint}</p>
      <p className="home-landing__units-greeting">
        Hej {displayName} — dashboard og Min side er samlet her.
      </p>

      <ul className="home-landing__units-grid">
        {widgets.map((instance) => {
          const definition = definitionForKind(instance.kind);
          const visual = visualForKind(instance.kind);
          const Icon = visual.icon;
          const href = buildWorkspaceHref({
            space,
            view: "widget",
            widgetInstanceId: instance.instanceId,
          });

          return (
            <li key={instance.instanceId} className="home-landing__units-item">
              <Link
                href={href}
                className="home-landing__unit-card group"
                style={
                  {
                    "--unit-accent": visual.accent,
                    "--unit-accent-soft": visual.accentSoft,
                  } as React.CSSProperties
                }
              >
                <div className="home-landing__unit-card-icon">
                  <Icon className="size-5" aria-hidden />
                </div>
                <span className="home-landing__unit-card-title min-w-0 flex-1">{definition.label}</span>
                <ArrowUpRight
                  className="home-landing__unit-card-arrow size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-50"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
