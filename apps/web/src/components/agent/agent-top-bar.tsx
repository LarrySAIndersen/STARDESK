"use client";

import { Bell, Search, Settings } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export function AgentTopBar({ title }: { title?: string }) {
  return (
    <header className="border-border bg-card/80 sticky top-0 z-40 shrink-0 border-b backdrop-blur-sm">
      <section className="flex items-center gap-4 px-6 py-3">
        <label className="relative min-w-0 flex-1 sm:max-w-md lg:max-w-xl">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Søg sager, brugere, aktiver…"
            className="border-input bg-muted/60 text-foreground placeholder:text-muted-foreground h-10 w-full rounded-full border-0 pr-4 pl-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Søg"
          />
        </label>

        {title ? (
          <h1 className="text-foreground hidden shrink-0 text-lg font-semibold tracking-tight xl:block">
            {title}
          </h1>
        ) : null}

        <section className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors"
            aria-label="Notifikationer"
          >
            <Bell className="size-[18px] stroke-[1.75]" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors"
            aria-label="Indstillinger"
          >
            <Settings className="size-[18px] stroke-[1.75]" />
          </button>
          <ThemeToggle />
          <UserMenu />
        </section>
      </section>
    </header>
  );
}
