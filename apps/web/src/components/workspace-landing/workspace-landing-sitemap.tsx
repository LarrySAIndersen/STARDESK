"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  LayoutGrid,
  Search,
  Sparkles,
  User,
  Users,
} from "lucide-react";

import { WorkspaceBackLink } from "@/components/workspace-landing/workspace-back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WORKSPACE_WIDGET_CATALOG, definitionForKind } from "@/lib/workspace-landing/catalog";
import {
  buildWorkspaceHref,
  resolveWorkspaceBackHref,
} from "@/lib/workspace-landing/layout-utils";
import {
  buildSitemapEntries,
  filterSitemapEntries,
  type SitemapEntry,
  type SitemapStatusFilter,
} from "@/lib/workspace-landing/sitemap-utils";
import { SPACE_VISUALS, visualForKind } from "@/lib/workspace-landing/sitemap-visuals";
import type {
  WorkspaceLandingConfig,
  WorkspaceSpace,
  WorkspaceWidgetInstance,
} from "@/lib/workspace-landing/types";
import { cn } from "@/lib/utils";

type SpaceFilter = "all" | WorkspaceSpace;

type WorkspaceLandingSitemapProps = Readonly<{
  space: WorkspaceSpace;
  layout: WorkspaceLandingConfig;
  searchParams: string;
}>;

function entryHref(
  entry: SitemapEntry,
  spaceKey: WorkspaceSpace,
  searchParams: string,
): string {
  if (entry.instance) {
    return buildWorkspaceHref({
      space: spaceKey,
      view: "widget",
      widgetInstanceId: entry.instance.instanceId,
      from: "sitemap",
      preserveParams: searchParams,
    });
  }
  return buildWorkspaceHref({ space: spaceKey, view: "grid", preserveParams: searchParams });
}

function SitemapMiniMap({
  personalActive,
  teamActive,
  onSelectSpace,
  activeSpace,
}: Readonly<{
  personalActive: number;
  teamActive: number;
  onSelectSpace: (space: SpaceFilter) => void;
  activeSpace: SpaceFilter;
}>) {
  return (
    <div className="workspace-sitemap-map" aria-hidden>
      <button
        type="button"
        className={cn(
          "workspace-sitemap-map__node workspace-sitemap-map__node--personal",
          (activeSpace === "all" || activeSpace === "personal") && "workspace-sitemap-map__node--lit",
        )}
        onClick={() => onSelectSpace(activeSpace === "personal" ? "all" : "personal")}
      >
        <User className="size-4" />
        <span>Eget</span>
        <strong>{personalActive}</strong>
      </button>
      <div className="workspace-sitemap-map__bridge">
        <span className="workspace-sitemap-map__line" />
        <Sparkles className="workspace-sitemap-map__spark size-3.5" />
        <span className="workspace-sitemap-map__line" />
      </div>
      <button
        type="button"
        className={cn(
          "workspace-sitemap-map__node workspace-sitemap-map__node--team",
          (activeSpace === "all" || activeSpace === "team") && "workspace-sitemap-map__node--lit",
        )}
        onClick={() => onSelectSpace(activeSpace === "team" ? "all" : "team")}
      >
        <Users className="size-4" />
        <span>Team</span>
        <strong>{teamActive}</strong>
      </button>
    </div>
  );
}

function SitemapCard({
  entry,
  spaceKey,
  searchParams,
}: Readonly<{
  entry: SitemapEntry;
  spaceKey: WorkspaceSpace;
  searchParams: string;
}>) {
  const visual = visualForKind(entry.kind);
  const Icon = visual.icon;
  const href = entryHref(entry, spaceKey, searchParams);
  const spaceVisual = SPACE_VISUALS[spaceKey];

  return (
    <Link
      href={href}
      className={cn(
        "workspace-sitemap-card workspace-sitemap-card--interactive group",
        entry.active ? "workspace-sitemap-card--active" : "workspace-sitemap-card--inactive",
      )}
      style={
        {
          "--widget-accent": visual.accent,
          "--widget-accent-soft": visual.accentSoft,
          "--space-ring": spaceVisual.ring,
        } as CSSProperties
      }
    >
      <div className="workspace-sitemap-card__glow" aria-hidden />
      <div className="workspace-sitemap-card__icon-wrap">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="workspace-sitemap-card__content">
        <div className="workspace-sitemap-card__top">
          <h3 className="workspace-sitemap-card__title">{entry.label}</h3>
          <ArrowUpRight
            className="workspace-sitemap-card__arrow size-4 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </div>
        <p className="workspace-sitemap-card__description">{entry.description}</p>
        <div className="workspace-sitemap-card__footer">
          {entry.active && entry.instance ? (
            <>
              <span className="workspace-sitemap-card__badge workspace-sitemap-card__badge--active">
                <CheckCircle2 className="size-3" aria-hidden />
                Aktiv
              </span>
              <span className="workspace-sitemap-card__meta">
                {entry.instance.span === "full" ? "Fuld bredde" : "Halv bredde"} · #
                {entry.instance.order + 1}
              </span>
            </>
          ) : (
            <span className="workspace-sitemap-card__badge workspace-sitemap-card__badge--muted">
              <CircleDashed className="size-3" aria-hidden />
              Ikke på overblik
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SitemapSection({
  spaceKey,
  entries,
  searchParams,
}: Readonly<{
  spaceKey: WorkspaceSpace;
  entries: SitemapEntry[];
  searchParams: string;
}>) {
  if (entries.length === 0) return null;

  const spaceVisual = SPACE_VISUALS[spaceKey];
  const activeCount = entries.filter((entry) => entry.active).length;

  return (
    <section className="workspace-sitemap-section">
      <header
        className="workspace-sitemap-section__header"
        style={{ "--space-gradient": spaceVisual.gradient } as CSSProperties}
      >
        <div className="workspace-sitemap-section__badge">{spaceVisual.label}</div>
        <div>
          <h2 className="workspace-sitemap-section__title">{spaceVisual.label}</h2>
          <p className="workspace-sitemap-section__hint">
            {activeCount} aktive · {entries.length} i kataloget
          </p>
        </div>
      </header>
      <ul className="workspace-sitemap-section__grid">
        {entries.map((entry) => (
          <li key={entry.kind}>
            <SitemapCard entry={entry} spaceKey={spaceKey} searchParams={searchParams} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MapIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function WorkspaceLandingSitemap({
  space,
  layout,
  searchParams,
}: WorkspaceLandingSitemapProps) {
  const backHref = resolveWorkspaceBackHref("sitemap", space, null, searchParams);
  const [query, setQuery] = useState("");
  const [spaceFilter, setSpaceFilter] = useState<SpaceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<SitemapStatusFilter>("all");

  const personalEntries = useMemo(
    () => buildSitemapEntries("personal", layout.personal),
    [layout.personal],
  );
  const teamEntries = useMemo(() => buildSitemapEntries("team", layout.team), [layout.team]);

  const filteredPersonal = filterSitemapEntries(personalEntries, query, statusFilter);
  const filteredTeam = filterSitemapEntries(teamEntries, query, statusFilter);
  const totalActive =
    personalEntries.filter((e) => e.active).length + teamEntries.filter((e) => e.active).length;
  const totalCatalog = WORKSPACE_WIDGET_CATALOG.length;
  const visibleCount = filteredPersonal.length + filteredTeam.length;

  const showPersonal = spaceFilter === "all" || spaceFilter === "personal";
  const showTeam = spaceFilter === "all" || spaceFilter === "team";

  return (
    <div className="workspace-sitemap">
      <WorkspaceBackLink href={backHref} label="Tilbage til overblik" className="mb-4" />

      <header className="workspace-sitemap-hero">
        <div className="workspace-sitemap-hero__copy">
          <p className="workspace-sitemap-hero__eyebrow">
            <MapIcon />
            Arbejdsrum
          </p>
          <h1 className="workspace-sitemap-hero__title">Sitemap</h1>
          <p className="workspace-sitemap-hero__lead">
            Interaktivt kort over alle widgets i dit arbejdsrum. Søg, filtrer og klik for at åbne
            et element.
          </p>
        </div>
        <div className="workspace-sitemap-hero__stats">
          <div className="workspace-sitemap-stat">
            <span className="workspace-sitemap-stat__value">{totalActive}</span>
            <span className="workspace-sitemap-stat__label">Aktive</span>
          </div>
          <div className="workspace-sitemap-stat">
            <span className="workspace-sitemap-stat__value">{totalCatalog}</span>
            <span className="workspace-sitemap-stat__label">I alt</span>
          </div>
          <div className="workspace-sitemap-stat">
            <span className="workspace-sitemap-stat__value">{visibleCount}</span>
            <span className="workspace-sitemap-stat__label">Vises nu</span>
          </div>
        </div>
      </header>

      <SitemapMiniMap
        personalActive={personalEntries.filter((e) => e.active).length}
        teamActive={teamEntries.filter((e) => e.active).length}
        activeSpace={spaceFilter}
        onSelectSpace={setSpaceFilter}
      />

      <div className="workspace-sitemap-toolbar">
        <div className="workspace-sitemap-search">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Søg elementer…"
            className="workspace-sitemap-search__input border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="Søg i sitemap"
          />
        </div>
        <div className="workspace-sitemap-toolbar__filters">
          <div className="workspace-sitemap-tabs" role="tablist" aria-label="Filtrer space">
            {(
              [
                ["all", "Alle"],
                ["personal", "Eget"],
                ["team", "Team"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={spaceFilter === id}
                className={cn(
                  "workspace-sitemap-tabs__btn",
                  spaceFilter === id && "workspace-sitemap-tabs__btn--active",
                )}
                onClick={() => setSpaceFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="workspace-sitemap-tabs workspace-sitemap-tabs--status">
            {(
              [
                ["all", "Alle"],
                ["active", "Aktive"],
                ["inactive", "Skjulte"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "workspace-sitemap-tabs__btn workspace-sitemap-tabs__btn--compact",
                  statusFilter === id && "workspace-sitemap-tabs__btn--active",
                )}
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visibleCount === 0 ? (
        <div className="workspace-sitemap-empty">
          <LayoutGrid className="text-muted-foreground mb-3 size-10" aria-hidden />
          <p className="font-medium">Ingen elementer matcher filteret</p>
          <p className="text-muted-foreground mt-1 text-sm">Prøv en anden søgning eller nulstil filtrene.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              setQuery("");
              setSpaceFilter("all");
              setStatusFilter("all");
            }}
          >
            Nulstil filtre
          </Button>
        </div>
      ) : (
        <div className="workspace-sitemap__sections">
          {showPersonal ? (
            <SitemapSection
              spaceKey="personal"
              entries={filteredPersonal}
              searchParams={searchParams}
            />
          ) : null}
          {showTeam ? (
            <SitemapSection spaceKey="team" entries={filteredTeam} searchParams={searchParams} />
          ) : null}
        </div>
      )}
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
  const visual = visualForKind(instance.kind);
  const Icon = visual.icon;
  const backHref = resolveWorkspaceBackHref("widget", space, fromParam, searchParams);
  const backLabel = fromParam === "sitemap" ? "Tilbage til sitemap" : "Tilbage til overblik";

  return (
    <header
      className="workspace-widget-focus__header workspace-widget-focus__header--rich"
      style={
        {
          "--widget-accent": visual.accent,
          "--widget-accent-soft": visual.accentSoft,
        } as CSSProperties
      }
    >
      <WorkspaceBackLink href={backHref} label={backLabel} />
      <div className="workspace-widget-focus__hero mt-4">
        <div className="workspace-widget-focus__icon">
          <Icon className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="wire-sec-title text-xl">{definition.label}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{definition.description}</p>
        </div>
      </div>
    </header>
  );
}
