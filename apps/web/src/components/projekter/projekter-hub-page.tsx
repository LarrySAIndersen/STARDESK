"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, FolderKanban, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  filterProjekterHubItems,
} from "@/lib/projekter-hub";
import { cn } from "@/lib/utils";

export function ProjekterHubPage() {
  const [query, setQuery] = useState("");
  const items = useMemo(() => filterProjekterHubItems(query), [query]);

  return (
    <div className="wire-scroll-content min-h-0 flex-1 p-5">
      <header className="projekter-hub-hero">
        <div className="projekter-hub-hero__main">
          <p className="projekter-hub-hero__eyebrow">Projekt</p>
          <h1 className="projekter-hub-hero__title">Projektoversigt</h1>
          <p className="projekter-hub-hero__lead">
            Overblik over boards, backlog og sager — alle projektelementer
            samlet ét sted.
          </p>
        </div>
        <div className="projekter-hub-hero__badge" aria-hidden>
          <FolderKanban className="size-8" />
        </div>
      </header>

      <div className="workspace-sitemap-toolbar">
        <div className="workspace-sitemap-search">
          <Search className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <Input
            type="search"
            placeholder="Søg i projektelementer…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="workspace-sitemap-search__input border-0 shadow-none focus-visible:ring-0"
            aria-label="Søg i projektelementer"
          />
        </div>
        <div className="workspace-sitemap-stat">
          <span className="workspace-sitemap-stat__value">{items.length}</span>
          <span className="workspace-sitemap-stat__label">elementer</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="workspace-sitemap-empty">
          <p className="text-star-navy text-sm font-medium">Ingen match på søgningen</p>
          <p className="text-muted-foreground mt-1 text-sm">Prøv et andet ord eller ryd søgefeltet.</p>
        </div>
      ) : (
        <ul className="projekter-hub-grid">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="projekter-hub-card group"
                  style={
                    {
                      "--projekt-accent": item.accent,
                      "--projekt-accent-soft": item.accentSoft,
                    } as React.CSSProperties
                  }
                >
                  <div className="projekter-hub-card__icon">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="projekter-hub-card__body">
                    <span className="projekter-hub-card__title">{item.label}</span>
                    <span className="projekter-hub-card__desc">{item.description}</span>
                  </div>
                  <ArrowUpRight
                    className={cn(
                      "projekter-hub-card__arrow size-4 shrink-0",
                      "opacity-0 transition-opacity group-hover:opacity-60",
                    )}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-muted-foreground mt-8 text-xs">
        Tip: Brug <strong>Tilbage</strong> i topbaren eller browserens historik for at returnere til
        forrige side.
      </p>
    </div>
  );
}
