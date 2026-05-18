import { cn } from "@/lib/utils";

export function WireTags({
  tags,
  max = 4,
}: {
  tags?: string[];
  max?: number;
}) {
  const visible = (tags ?? []).slice(0, max);
  if (visible.length === 0) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((tag, i) => (
        <span
          key={tag}
          className={cn(
            "wire-tag",
            i === 0 && tag.toLowerCase().includes("outlook") && "wire-tag--red",
          )}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
