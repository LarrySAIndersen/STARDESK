"use client";

import { notFound } from "next/navigation";
import Link from "next/link";

import { HelpABotChromeTrigger } from "@/components/agent/help-a-bot-chrome-trigger";
import { ThemePaletteProvider } from "@/components/providers/theme-palette-provider";
import { ThemePalettePicker } from "@/components/theme-palette-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { StarLogo } from "@/components/star-logo";
import { Button } from "@/components/ui/button";
import type { User } from "@/types/user";

const MOCK_STAFF: User = {
  id: "00000000-0000-0000-0000-000000000030",
  email: "sf01@example.dk",
  display_name: "Anna Agent",
  role: "admin",
  role_label: "Administrator",
  theme_palette: { preset_id: "ocean" },
};

export default function ThemePaletteDevPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <ThemePaletteProvider preference={MOCK_STAFF.theme_palette} enabled />

      <header className="wire-topheader wire-topheader--toolbar">
        <div className="flex min-w-0 flex-1 items-stretch gap-0">
          <Link href="/" className="flex shrink-0 items-center px-1">
            <StarLogo priority inverted />
          </Link>
          <div className="wire-topheader__brand-text">
            <span className="wire-topheader__brand-title">STARDesk</span>
            <span className="wire-topheader__brand-sub">STAR itsm</span>
          </div>
          <HelpABotChromeTrigger />
        </div>
        <div className="wire-topheader__actions flex items-center gap-2">
          <ThemePalettePicker user={MOCK_STAFF} variant="chrome" defaultOpen />
          <ThemeToggle className="wire-topheader__theme" />
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            AA
          </span>
        </div>
      </header>

      <div className="wire-shell-accent" aria-hidden="true" />

      <main className="bg-background flex flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground text-xs">
          Dev-forhåndsvisning på <code>/dev/theme-palette</code> — ingen login påkrævet.
        </p>
        <section className="border-border bg-card text-card-foreground rounded-sm border p-4">
          <h1 className="text-primary text-lg font-semibold">Eksempelkort</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Indhold under bjælken følger paletten. Topbjælke, rød stribe og Help-a-Bot er låst.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button">Primær handling</Button>
            <Button type="button" variant="secondary">
              Sekundær
            </Button>
          </div>
        </section>
        <section className="bg-accent text-accent-foreground rounded-sm p-4 text-sm">
          Accent-flade med automatisk kontrasttekst.
        </section>
      </main>
    </div>
  );
}
