"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  buildAssignablePeople,
  filterPeopleForSearch,
  type AssignablePerson,
} from "@/lib/assignment-search";
import type { Team } from "@/types/team";

type MentionTextareaProps = Readonly<{
  id?: string;
  value: string;
  onChange: (value: string) => void;
  teams: Team[];
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
}>;

function mentionTokenForPerson(person: AssignablePerson): string {
  return `@${person.displayName}`;
}

export function MentionTextarea({
  id,
  value,
  onChange,
  teams,
  rows = 4,
  placeholder,
  disabled,
  onPaste,
  className,
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const people = useMemo(() => buildAssignablePeople(teams), [teams]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    return filterPeopleForSearch(people, mentionQuery).slice(0, 8);
  }, [mentionQuery, people]);

  const closeSuggestions = useCallback(() => {
    setMentionQuery(null);
    setActiveIndex(0);
  }, []);

  const updateMentionQueryFromCaret = useCallback(
    (text: string, caret: number) => {
      const before = text.slice(0, caret);
      const at = before.lastIndexOf("@");
      if (at < 0) {
        closeSuggestions();
        return;
      }
      const prefix = before.slice(0, at);
      if (prefix.length > 0 && !/\s$/.test(prefix)) {
        closeSuggestions();
        return;
      }
      const query = before.slice(at + 1);
      if (query.includes("\n")) {
        closeSuggestions();
        return;
      }
      setMentionQuery(query);
      setActiveIndex(0);
    },
    [closeSuggestions],
  );

  function insertMention(person: AssignablePerson) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const at = before.lastIndexOf("@");
    if (at < 0) return;
    const token = mentionTokenForPerson(person);
    const next = `${before.slice(0, at)}${token} ${after}`;
    onChange(next);
    closeSuggestions();
    requestAnimationFrame(() => {
      const pos = at + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    onChange(next);
    updateMentionQueryFromCaret(next, event.target.selectionStart ?? next.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const option = suggestions[activeIndex];
      const person = people.find((p) => p.userId === option.id);
      if (person) insertMention(person);
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(closeSuggestions, 150)}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {mentionQuery !== null && suggestions.length > 0 ? (
        <ul
          className="border-input bg-popover absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border shadow-md"
          role="listbox"
          aria-label="Vælg person at omtale"
        >
          {suggestions.map((option, index) => (
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex ? "true" : "false"}
                className={cn(
                  "hover:bg-accent w-full px-3 py-2 text-left text-sm",
                  index === activeIndex && "bg-accent",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const person = people.find((p) => p.userId === option.id);
                  if (person) insertMention(person);
                }}
              >
                <span className="font-medium">{option.label}</span>
                {option.sublabel ? (
                  <span className="text-muted-foreground ml-2 text-xs">{option.sublabel}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
