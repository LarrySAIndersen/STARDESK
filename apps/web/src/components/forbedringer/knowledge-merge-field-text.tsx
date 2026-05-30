import Link from "next/link";
import type { ReactNode } from "react";

import {
  knowledgeHrefForRef,
  parseMergeFields,
  ticketHrefForNumber,
  type MergeFieldKind,
} from "@/lib/knowledge-merge-fields";
import { cn } from "@/lib/utils";

type MergeLinkResolver = (
  kind: MergeFieldKind,
  ref: string,
) => { href: string; label: string };

const defaultResolver: MergeLinkResolver = (kind, ref) => {
  if (kind === "sag") {
    return { href: ticketHrefForNumber(ref), label: ref };
  }
  return { href: knowledgeHrefForRef(ref), label: ref };
};

export function KnowledgeMergeFieldText({
  text,
  className,
  resolveLink = defaultResolver,
}: {
  text: string;
  className?: string;
  resolveLink?: MergeLinkResolver;
}) {
  const fields = parseMergeFields(text);
  if (fields.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const field of fields) {
    if (field.index > cursor) {
      parts.push(text.slice(cursor, field.index));
    }
    const { href, label } = resolveLink(field.kind, field.ref);
    parts.push(
      <Link
        key={`${field.raw}-${field.index}`}
        href={href}
        className={cn(
          "text-primary font-medium underline-offset-2 hover:underline",
          field.kind === "sag" ? "decoration-star-navy/40" : "decoration-star-red/40",
        )}
      >
        {label}
      </Link>,
    );
    cursor = field.index + field.raw.length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <span className={className}>{parts}</span>;
}
