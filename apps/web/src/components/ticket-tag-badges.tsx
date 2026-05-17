import { Badge } from "@/components/ui/badge";

export function TicketTagBadges({
  tags,
  emoji,
  maxTags = 3,
}: {
  tags?: string[];
  emoji?: string | null;
  maxTags?: number;
}) {
  const visible = (tags ?? []).slice(0, maxTags);
  const rest = (tags ?? []).length - visible.length;

  if (!emoji && visible.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {emoji ? (
        <span className="text-lg leading-none" title="Sag-emoji" aria-label="Sag-emoji">
          {emoji}
        </span>
      ) : null}
      {visible.map((tag) => (
        <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
          {tag}
        </Badge>
      ))}
      {rest > 0 ? (
        <span className="text-muted-foreground text-[10px]">+{rest}</span>
      ) : null}
    </div>
  );
}
