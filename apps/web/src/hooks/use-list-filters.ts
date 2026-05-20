"use client";

import { useCallback, useMemo, useState } from "react";

export type UseListFiltersOptions<
  TTab extends string,
  TFilters extends Record<string, string>,
> = {
  defaultSearch?: string;
  defaultTab?: TTab;
  defaultFilters?: TFilters;
};

function filtersMatchDefaults<TFilters extends Record<string, string>>(
  filters: TFilters,
  defaults: TFilters,
): boolean {
  return (Object.keys(defaults) as (keyof TFilters)[]).every(
    (key) => filters[key] === defaults[key],
  );
}

export function useListFilters<
  TTab extends string,
  TFilters extends Record<string, string>,
>({
  defaultSearch = "",
  defaultTab,
  defaultFilters = {} as TFilters,
}: UseListFiltersOptions<TTab, TFilters>) {
  const [search, setSearch] = useState(defaultSearch);
  const [tab, setTab] = useState<TTab | undefined>(defaultTab);
  const [filters, setFilters] = useState<TFilters>(defaultFilters);

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => {
    setSearch(defaultSearch);
    if (defaultTab !== undefined) {
      setTab(defaultTab);
    }
    setFilters(defaultFilters);
  }, [defaultSearch, defaultTab, defaultFilters]);

  const hasActiveFilters = useMemo(() => {
    if (search !== defaultSearch) {
      return true;
    }
    if (defaultTab !== undefined && tab !== defaultTab) {
      return true;
    }
    return !filtersMatchDefaults(filters, defaultFilters);
  }, [search, defaultSearch, tab, defaultTab, filters, defaultFilters]);

  return {
    search,
    setSearch,
    tab: tab as TTab,
    setTab,
    filters,
    setFilters,
    setFilter,
    reset,
    hasActiveFilters,
  };
}

/** True when any dashboard / list URL param differs from the cleared /tickets view. */
export function hasActiveFiltersBeyond(
  values: Record<string, string | undefined>,
  defaults: Record<string, string | undefined>,
): boolean {
  return Object.keys(defaults).some((key) => {
    const current = values[key] ?? "";
    const baseline = defaults[key] ?? "";
    return current !== baseline;
  });
}
