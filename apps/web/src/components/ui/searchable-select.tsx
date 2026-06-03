"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchableOption } from "@/lib/assignment-search";

export function SearchableSelect({
  valueId,
  displayValue,
  options,
  placeholder,
  emptyLabel,
  disabled,
  onQueryChange,
  onSelect,
  className,
  listId,
  allowClear = true,
}: {
  valueId: string | null;
  displayValue: string;
  options: SearchableOption[];
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  onQueryChange?: (query: string) => void;
  onSelect: (option: SearchableOption) => void;
  className?: string;
  listId?: string;
  /** When false, the list has no "clear" row (for required fields like prioritet). */
  allowClear?: boolean;
}) {
  const inputId = useId();
  const listboxId = listId ?? `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const shownValue = open ? query : displayValue;

  useEffect(() => {
    if (!open) {
      setQuery("");
      onQueryChange?.("");
    }
  }, [open, onQueryChange]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const visibleOptions = useMemo(() => {
    if (!allowClear) {
      return options;
    }
    const clearOption: SearchableOption = { id: "", label: emptyLabel };
    return [clearOption, ...options];
  }, [allowClear, emptyLabel, options]);

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <Input
        id={inputId}
        name={`stardesk-${inputId}`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        list=""
        disabled={disabled}
        value={shownValue}
        placeholder={placeholder}
        className="border-[var(--gray-border)] bg-card text-card-foreground placeholder:text-muted-foreground h-8 text-right text-xs"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          onQueryChange?.(next);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && !disabled ? (
        <ul
          id={listboxId}
          role="listbox"
          className="border-border bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-1 max-h-48 w-full min-w-[220px] overflow-y-auto rounded-[2px] border py-1 text-left shadow-md"
        >
          {options.length === 0 && query.trim() ? (
            <li className="text-muted-foreground px-3 py-2 text-xs">Ingen match</li>
          ) : (
            visibleOptions.map((option) => (
              <li key={option.id || "__none__"} role="option" aria-selected={valueId === option.id}>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-[var(--gray-bg)] w-full px-3 py-2 text-left text-xs",
                    valueId === option.id && "bg-[var(--gray-bg)] font-semibold",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option);
                    setOpen(false);
                  }}
                >
                  <span className="text-star-navy block font-medium">{option.label}</span>
                  {option.sublabel ? (
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {option.sublabel}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
