"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  classicHomePath,
  modernHomePath,
  type UiMode,
} from "@/lib/classic-ui-mode";

async function persistUiMode(mode: UiMode): Promise<void> {
  const response = await fetch("/api/auth/ui-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) {
    throw new Error("Kunne ikke gemme UI-præference");
  }
}

export function ClassicUiSwitcher({
  targetMode,
  label,
  className,
}: {
  targetMode: UiMode;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchMode() {
    setBusy(true);
    try {
      await persistUiMode(targetMode);
      router.push(targetMode === "classic" ? classicHomePath() : modernHomePath());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={() => void switchMode()}
    >
      {busy ? "Skifter…" : label}
    </button>
  );
}
