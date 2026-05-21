"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="border-star-blue/30 flex h-7 w-[7.25rem] rounded-sm border"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <div
      role="group"
      aria-label="Vælg tema"
      className="border-border flex overflow-hidden rounded-sm border bg-muted/30"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={!isDark}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors",
          !isDark
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Sun className="size-3.5" aria-hidden />
        Dag
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={isDark}
        className={cn(
          "inline-flex items-center gap-1 border-l border-border px-2.5 py-1 text-xs font-semibold transition-colors",
          isDark
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Moon className="size-3.5" aria-hidden />
        Nat
      </button>
    </div>
  );
}
