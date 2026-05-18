"use client";

import { useState } from "react";

export function WireAiBanner({
  children,
  onAccept,
  onDecline,
}: {
  children: React.ReactNode;
  onAccept?: () => void;
  onDecline?: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) {
    return null;
  }
  return (
    <div className="wire-ai-banner" role="region" aria-label="AI-anbefaling">
      <span className="wire-ai-pill">AI</span>
      <div className="wire-ai-text">{children}</div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          className="rounded-[2px] bg-[var(--ai-purple)] px-2.5 py-1 text-[11px] font-semibold text-white"
          onClick={() => {
            onAccept?.();
            setHidden(true);
          }}
        >
          Accepter
        </button>
        <button
          type="button"
          className="rounded-[2px] border border-[#6b6fd4] bg-transparent px-2.5 py-1 text-[11px] text-[var(--ai-purple)]"
          onClick={() => {
            onDecline?.();
            setHidden(true);
          }}
        >
          Afvis
        </button>
      </div>
    </div>
  );
}
