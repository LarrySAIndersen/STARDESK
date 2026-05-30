"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildAssignablePeople,
  filterPeopleForSearch,
  type AssignablePerson,
  type SearchableOption,
} from "@/lib/assignment-search";
import type { Team } from "@/types/team";

function personLabel(person: AssignablePerson): string {
  return person.displayName;
}

export function UserMultiSelect({
  teams,
  selectedUserIds,
  onChange,
  placeholder,
  disabled,
}: {
  teams: Team[];
  selectedUserIds: string[];
  onChange: (userIds: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const people = useMemo(() => buildAssignablePeople(teams), [teams]);
  const selectedPeople = useMemo(
    () => people.filter((person) => selectedUserIds.includes(person.userId)),
    [people, selectedUserIds],
  );

  const options = useMemo(() => {
    const available = people.filter((person) => !selectedUserIds.includes(person.userId));
    return filterPeopleForSearch(available, query);
  }, [people, query, selectedUserIds]);

  function handleSelect(option: SearchableOption) {
    if (!option.id || selectedUserIds.includes(option.id)) {
      return;
    }
    onChange([...selectedUserIds, option.id]);
    setQuery("");
  }

  function removeUser(userId: string) {
    onChange(selectedUserIds.filter((id) => id !== userId));
  }

  return (
    <div className="space-y-2">
      {selectedPeople.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selectedPeople.map((person) => (
            <li key={person.userId}>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gray-border)] bg-[var(--gray-bg)] px-2 py-0.5 text-xs">
                <span>{personLabel(person)}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-star-navy rounded p-0.5"
                  aria-label={`Fjern ${person.displayName}`}
                  disabled={disabled}
                  onClick={() => removeUser(person.userId)}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <SearchableSelect
        valueId={null}
        displayValue=""
        options={options}
        placeholder={placeholder}
        emptyLabel="Ingen brugere fundet"
        disabled={disabled}
        allowClear={false}
        onQueryChange={setQuery}
        onSelect={handleSelect}
      />
    </div>
  );
}
