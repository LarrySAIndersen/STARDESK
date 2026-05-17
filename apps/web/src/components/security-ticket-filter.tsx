"use client";

export function SecurityTicketFilter({
  checked,
  onChange,
  id = "security-only-filter",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="size-4 rounded border"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>Kun sikkerhedssager</span>
    </label>
  );
}
