"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { SidebarUiModeSwitch } from "@/components/sidebar-ui-mode-switch";
import { CLASSIC_MODULES } from "@/lib/classic-modules";
import { canChooseModernUi } from "@/lib/classic-ui-mode";
import { cn } from "@/lib/utils";
import type { User } from "@/types/user";

const PRIMARY_LINKS = [
  { href: "/classic", label: "Start" },
  { href: "/classic/my-work", label: "Mit arbejde" },
] as const;

export function ClassicSidebar({ user }: { user?: User | null }) {
  const pathname = usePathname();
  const showModernSwitch = canChooseModernUi(user ?? null);
  const onModernRoute = pathname === "/" || (!pathname.startsWith("/classic") && !pathname.startsWith("/portal"));

  return (
    <nav className="classic-sidebar" aria-label="Klassisk navigation">
      <p className="classic-sidebar__heading">Overblik</p>
      <ul className="classic-sidebar__list">
        {PRIMARY_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "classic-sidebar__link",
                pathname === item.href && "classic-sidebar__link--active",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="classic-sidebar__heading">Moduler</p>
      <ul className="classic-sidebar__list">
        {CLASSIC_MODULES.map((classicModule) => (
          <li key={classicModule.id}>
            <Link
              href={classicModule.href}
              className={cn(
                "classic-sidebar__link",
                pathname === classicModule.href && "classic-sidebar__link--active",
              )}
            >
              {classicModule.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="classic-sidebar__heading">Handlinger</p>
      <ul className="classic-sidebar__list">
        <li>
          <Link href="/tickets/new" className="classic-sidebar__link">
            Ny sag
          </Link>
        </li>
        <li>
          <Link href="/reports" className="classic-sidebar__link">
            Rapporter
          </Link>
        </li>
      </ul>

      {showModernSwitch ? (
        <>
          <p className="classic-sidebar__heading">Grænseflade</p>
          <div className="classic-sidebar__switch">
            <SidebarUiModeSwitch
              targetMode="modern"
              label="Moderne STARdesk"
              icon={LayoutDashboard}
              active={onModernRoute}
            />
          </div>
        </>
      ) : null}
    </nav>
  );
}
