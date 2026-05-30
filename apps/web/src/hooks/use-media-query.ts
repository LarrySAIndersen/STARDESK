"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True when viewport is at least Tailwind `lg` (1024px). */
export function useIsLgUp(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

/** True when viewport is at least Tailwind `md` (768px). */
export function useIsMdUp(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
