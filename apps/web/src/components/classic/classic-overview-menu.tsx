"use client";

import {
  ChevronRight,
  Eye,
  Home,
  LayoutGrid,
  PanelLeftClose,
  PanelsTopLeft,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useClassicWorkTabs } from "@/components/classic/classic-work-tabs-context";
import { CLASSIC_HOME_HREF } from "@/lib/classic-work-tabs";
import { cn } from "@/lib/utils";

export function ClassicOverviewMenuButton() {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const { recentCards, closeAllTabs, closeOtherTabs, goHome, refreshRecentCards } =
    useClassicWorkTabs();

  const closeMenu = useCallback(() => {
    setOpen(false);
    setRecentOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => {
    if (open) refreshRecentCards();
  }, [open, refreshRecentCards]);

  return (
    <div className="classic-overview" ref={rootRef}>
      <button
        type="button"
        className="classic-topbar__icon-btn"
        aria-label="Overblik"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title="Overblik"
        onClick={() => setOpen((v) => !v)}
      >
        <LayoutGrid className="size-[18px]" aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          className="classic-overview__menu"
          role="menu"
          onMouseLeave={() => setRecentOpen(false)}
        >
          <Link
            href={CLASSIC_HOME_HREF}
            role="menuitem"
            className="classic-overview__item"
            onClick={() => {
              goHome();
              closeMenu();
            }}
          >
            <Home className="classic-overview__icon" aria-hidden />
            <span>Forside</span>
          </Link>

          <div
            className="classic-overview__item-wrap"
            onMouseEnter={() => setRecentOpen(true)}
          >
            <button
              type="button"
              role="menuitem"
              className={cn(
                "classic-overview__item classic-overview__item--sub",
                recentOpen && "classic-overview__item--open",
              )}
              aria-expanded={recentOpen}
              onClick={() => setRecentOpen((v) => !v)}
            >
              <Eye className="classic-overview__icon" aria-hidden />
              <span>Nyligt viste kort</span>
              <ChevronRight className="classic-overview__chevron" aria-hidden />
            </button>

            {recentOpen ? (
              <div
                className="classic-overview__flyout"
                role="menu"
                aria-label="Nyligt viste kort"
              >
                {recentCards.length === 0 ? (
                  <p className="classic-overview__flyout-empty">
                    Ingen nyligt viste sager endnu.
                  </p>
                ) : (
                  <ul className="classic-overview__flyout-list">
                    {recentCards.map((card, index) => (
                      <li key={card.id}>
                        <Link
                          href={card.href}
                          role="menuitem"
                          className={cn(
                            "classic-overview__flyout-item",
                            index === 0 && "classic-overview__flyout-item--highlight",
                          )}
                          onClick={closeMenu}
                        >
                          <span className="classic-overview__flyout-icon" aria-hidden>
                            2
                          </span>
                          <span className="classic-overview__flyout-text">
                            <span className="classic-overview__flyout-title">
                              {card.ticketNumber} {card.title}
                            </span>
                            <span className="classic-overview__flyout-sub">
                              {card.subtitle}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            role="menuitem"
            className="classic-overview__item"
            onClick={() => {
              closeAllTabs();
              closeMenu();
            }}
          >
            <PanelsTopLeft className="classic-overview__icon" aria-hidden />
            <span>Luk alle faner</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="classic-overview__item"
            onClick={() => {
              closeOtherTabs();
              closeMenu();
            }}
          >
            <PanelLeftClose className="classic-overview__icon" aria-hidden />
            <span>Luk andre faner</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
