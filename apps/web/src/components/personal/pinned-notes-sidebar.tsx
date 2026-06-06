"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pin, StickyNote } from "lucide-react";

import { apiGet } from "@/lib/api";
import { personalNoteColorClass } from "@/lib/personal-note-colors";
import { cn } from "@/lib/utils";
import type { PersonalNote } from "@/types/personal";

export function PinnedNotesSidebar({ collapsed }: { collapsed: boolean }) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadPinned = useCallback(async () => {
    try {
      const data = await apiGet<PersonalNote[]>("/api/v1/personal/notes");
      setNotes(data.filter((n) => n.is_pinned));
    } catch {
      setNotes([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadPinned();
  }, [loadPinned]);

  useEffect(() => {
    const onFocus = () => void loadPinned();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPinned]);

  if (!loaded || notes.length === 0) {
    return null;
  }

  if (collapsed) {
    return (
      <div className="border-t border-[var(--gray-border)] px-2 py-2">
        <Link
          href="/min-side"
          className="wire-nav-item wire-nav-item--compact flex items-center justify-center"
          title={`${notes.length} fastgjorte sedler`}
          aria-label={`${notes.length} fastgjorte sedler på Min side`}
        >
          <StickyNote className="size-[18px] shrink-0 text-star-navy opacity-80" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--gray-border)] px-3 py-2">
      <p className="text-muted-foreground mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wide uppercase">
        <Pin className="size-3 shrink-0 opacity-70" aria-hidden />
        Fastgjorte sedler
      </p>
      <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {notes.map((note, index) => (
          <li key={note.id}>
            <Link
              href="/min-side"
              className={cn(
                "post-it-note post-it-note--sidebar block rounded-sm border px-2 py-1.5 text-xs leading-snug shadow-sm transition-transform hover:-translate-y-px hover:shadow-md",
                personalNoteColorClass(note.color),
                index % 2 === 0 ? "-rotate-[0.6deg]" : "rotate-[0.5deg]",
              )}
              title={note.content || note.title}
            >
              <span className="line-clamp-2 font-semibold">{note.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
