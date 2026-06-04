"use client";

import { createContext, useContext, type ReactNode } from "react";

type ShellNavPanelContextValue = Readonly<{
  toggleNav: () => void;
}>;

const ShellNavPanelContext = createContext<ShellNavPanelContextValue | null>(null);

export function ShellNavPanelProvider({
  children,
  toggleNav,
}: {
  children: ReactNode;
  toggleNav: () => void;
}) {
  return (
    <ShellNavPanelContext.Provider value={{ toggleNav }}>{children}</ShellNavPanelContext.Provider>
  );
}

/** Prefer this over raw useSidebarCollapsed().toggle inside agent/portal nav. */
export function useShellNavPanelToggle(fallback?: () => void): () => void {
  const ctx = useContext(ShellNavPanelContext);
  return ctx?.toggleNav ?? fallback ?? (() => {});
}
