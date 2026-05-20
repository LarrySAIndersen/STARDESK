"use client";

import { useMemo, useState } from "react";

import { SearchInput } from "@/components/ui/search-input";

export function CategoryScopedSearch({
  categoryName,
  onQueryChange,
}: {
  categoryName: string;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const placeholder = useMemo(
    () => `Søg i ${categoryName}...`,
    [categoryName],
  );

  function handleChange(value: string) {
    setQuery(value);
    onQueryChange?.(value);
  }

  return (
    <SearchInput
      value={query}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full"
    />
  );
}
