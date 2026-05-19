"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TicketSearchInput({
  value,
  onChange,
  id = "ticket-search",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="sr-only">
        Søg i sager
      </Label>
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Søg på tags, titel eller sagsnr…"
        className="wire-search-input max-w-md"
      />
    </div>
  );
}
