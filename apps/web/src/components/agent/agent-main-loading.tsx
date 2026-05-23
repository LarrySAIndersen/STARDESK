/** Compact loading state for agent main content — avoids duplicate "Henter sager" copy. */
export function AgentMainLoading() {
  return (
    <div
      className="flex min-h-[12rem] flex-1 flex-col items-center justify-center gap-3 px-5 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="border-star-navy/20 border-t-star-navy size-8 animate-spin rounded-full border-2"
        aria-hidden
      />
      <p className="text-muted-foreground text-sm">Indlæser…</p>
    </div>
  );
}
