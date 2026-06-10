"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Kp2UserMenu } from "@/components/kundeportal-2/kp2-user-menu";
import { SearchInput } from "@/components/ui/search-input";
import { getClientUser } from "@/lib/auth";
import { KP2_BASE } from "@/lib/kundeportal-2/types";
import { resolveUserAvatar } from "@/lib/user-avatar";

export function Kp2GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${KP2_BASE}/soeg?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className={className}>
      <label htmlFor="kp2-global-search" className="sr-only">
        Søg i sager og katalog
      </label>
      <SearchInput
        id="kp2-global-search"
        value={query}
        onChange={setQuery}
        placeholder="Brug nøgleord til søgning"
        aria-label="Søg i sager og katalog"
        className="max-w-none"
      />
    </form>
  );
}

export function Kp2Header() {
  const user = resolveUserAvatar(getClientUser());
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`${KP2_BASE}/soeg?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="kp2-header">
      <div className="kp2-header-top">
        <div className="kp2-brand">
          <div className="kp2-brand-crown" aria-hidden>
            ♔
          </div>
          <div>
            <p className="kp2-brand-title">Styrelsen for Arbejdsmarked og Rekruttering</p>
            <p className="kp2-brand-sub">Kundeportal #2</p>
          </div>
        </div>
        {user ? <Kp2UserMenu user={user} /> : null}
      </div>
      <div className="kp2-hero">
        <form className="kp2-search" onSubmit={onSearchSubmit} role="search">
          <label htmlFor="kp2-global-search" className="sr-only">
            Søg i sager og katalog
          </label>
          <input
            id="kp2-global-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Brug nøgleord til søgning"
            className="kp2-search-input"
          />
          <button type="submit" className="kp2-search-btn" aria-label="Søg">
            <Search className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
