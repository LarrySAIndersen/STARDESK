"use client";

import Link from "next/link";

import { WorkspaceBackLink } from "@/components/workspace-landing/workspace-back-link";
import {
  WORKSPACE_WIDGET_CATALOG,
  definitionForKind,
} from "@/lib/workspace-landing/catalog";
import {
  buildWorkspaceHref,
  resolveWorkspaceBackHref,
  visibleWidgetInstances,
} from "@/lib/workspace-landing/layout-utils";
import type {
  WorkspaceLandingConfig,
  WorkspaceSpace,
  WorkspaceWidgetInstance,
} from "@/lib/workspace-landing/types";

const SPACE_LABELS: Record<WorkspaceSpace, string> = {
  personal: "Eget space",
  team: "Team space",
};

type WorkspaceLandingSitemapProps = Readonly<{
  space: WorkspaceSpace;
  layout: WorkspaceLandingConfig;
  searchParams: string;
}>;

function SitemapSection({
  spaceKey,
  instances,
  searchParams,
}: Readonly<{
  spaceKey: WorkspaceSpace;
  instances: WorkspaceWidgetInstance[];
  searchParams: string;
}>) {
  const visible = visibleWidgetInstances(instances);
  const catalogForSpace = WORKSPACE_WIDGET_CATALOG.filter((item) => item.space === spaceKey);

  return (
    <section className="workspace-sitemap-section">
      <h2 className="workspace-sitemap-section__title">{SPACE_LABELS[spaceKey]}</h2>
      <p className="workspace-sitemap-section__hint">
        {visible.length} aktive elementer · {catalogForSpace.length} tilgængelige i alt
      </p>
      <ul className="workspace-sitemap-section__list">
        {catalogForSpace.map((definition) => {
          const instance = visible.find((item) => item.kind === definition.kind);
          const href = instance
            ? buildWorkspaceHref({
                space: spaceKey,
                view: "widget",
                widgetInstanceId: instance.instanceId,
                from: "sitemap",
                preserveParams: searchParams,
              })
            : buildWorkspaceHref({ space: spaceKey, view: "grid", preserveParams: searchParams });

          return (
            <li key={definition.kind} className="workspace-sitemap-card">
              <div className="workspace-sitemap-card__body">
                <h3 className="workspace-sitemap-card__title">{definition.label}</h3>
                <p className="workspace-sitemap-card__description">{definition.description}</p>
                <p className="workspace-sitemap-card__meta">
                  {instance ? (
                    <span className="workspace-sitemap-card__status workspace-sitemap-card__status--active">
                      Aktiv på overblikket
                    </span>
                  ) : (
                    <span className="workspace-sitemap-card__status">Ikke tilføjet endnu</span>
                  )}
                </p>
              </div>
              {instance ? (
                <Link href={href} className="workspace-sitemap-card__link">
                  Åbn element →
                </Link>
              ) : (
                <Link
                  href={buildWorkspaceHref({ space: spaceKey, view: "grid", preserveParams: searchParams })}
                  className="workspace-sitemap-card__link workspace-sitemap-card__link--muted"
                >
                  Gå til overblik
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function WorkspaceLandingSitemap({
  space,
  layout,
  searchParams,
}: WorkspaceLandingSitemapProps) {
  const backHref = resolveWorkspaceBackHref("sitemap", space, null, searchParams);

  return (
    <div className="workspace-sitemap">
      <WorkspaceBackLink href={backHref} label="Tilbage til overblik" className="mb-4" />
      <header className="workspace-sitemap__header">
        <h1 className="wire-sec-title text-xl">Sitemap — arbejdsrum</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Oversigt over alle elementer i dit arbejdsrum. Klik for at åbne et element på en
          dedikeret side.
        </p>
      </header>

      <div className="workspace-sitemap__sections">
        <SitemapSection
          spaceKey="personal"
          instances={layout.personal}
          searchParams={searchParams}
        />
        <SitemapSection
          spaceKey="team"
          instances={layout.team}
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}

export function WorkspaceWidgetFocusHeader({
  instance,
  space,
  fromParam,
  searchParams,
}: Readonly<{
  instance: WorkspaceWidgetInstance;
  space: WorkspaceSpace;
  fromParam: string | null;
  searchParams: string;
}>) {
  const definition = definitionForKind(instance.kind);
  const backHref = resolveWorkspaceBackHref("widget", space, fromParam, searchParams);
  const backLabel = fromParam === "sitemap" ? "Tilbage til sitemap" : "Tilbage til overblik";

  return (
    <header className="workspace-widget-focus__header">
      <WorkspaceBackLink href={backHref} label={backLabel} />
      <div className="mt-3">
        <h1 className="wire-sec-title text-xl">{definition.label}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{definition.description}</p>
      </div>
    </header>
  );
}
