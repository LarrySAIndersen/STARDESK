"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type TicketExcelExportButtonProps = {
  className?: string;
  size?: "default" | "sm";
};

export function TicketExcelExportButton({
  className,
  size = "default",
}: TicketExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/v1/reports/tickets/export", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        throw new Error("export failed");
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "stardesk-sager.xlsx";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setError("Kunne ikke hente Excel-fil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="border-star-blue text-star-blue rounded-sm"
        onClick={() => void handleExport()}
        disabled={loading}
      >
        {loading ? "Eksporterer…" : "Eksporter til Excel"}
      </Button>
      {error ? <p className="text-star-red mt-2 text-sm">{error}</p> : null}
    </div>
  );
}
