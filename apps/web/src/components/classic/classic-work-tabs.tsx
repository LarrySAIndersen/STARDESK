"use client";

import { Home, List, Ticket, X } from "lucide-react";

import { useClassicWorkTabs } from "@/components/classic/classic-work-tabs-context";
import type { ClassicTabKind } from "@/lib/classic-work-tabs";
import { cn } from "@/lib/utils";

function TabIcon({ kind }: { kind: ClassicTabKind }) {
  const className = "size-3.5 shrink-0 opacity-90";
  if (kind === "home") return <Home className={className} aria-hidden />;
  if (kind === "ticket") return <Ticket className={className} aria-hidden />;
  return <List className={className} aria-hidden />;
}

export function ClassicWorkTabs() {
  const { tabs, activeTabId, activateTab, closeTab } = useClassicWorkTabs();

  return (
    <div className="classic-work-tabs" role="tablist" aria-label="Åbne kort">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="presentation"
            className={cn("classic-work-tabs__tab", active && "classic-work-tabs__tab--active")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="classic-work-tabs__select"
              onClick={() => activateTab(tab.id)}
              title={tab.label}
            >
              <TabIcon kind={tab.kind} />
              <span className="classic-work-tabs__label">{tab.label}</span>
            </button>
            {tab.closable ? (
              <button
                type="button"
                className="classic-work-tabs__close"
                aria-label={`Luk ${tab.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                <X className="size-3" aria-hidden />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
