import Link from "next/link";

import { Kp2Icon } from "@/components/kundeportal-2/kp2-icon";
import type { Kp2Tile } from "@/lib/kundeportal-2/types";

export function Kp2TileCard({ tile }: { tile: Kp2Tile }) {
  return (
    <Link
      href={tile.href}
      className="wire-portal-card group flex min-h-[7.5rem] flex-col items-center justify-center gap-2 sm:min-h-[8.5rem]"
    >
      <Kp2Icon
        name={tile.icon}
        className="text-star-navy size-8 opacity-80 transition-transform group-hover:scale-105 dark:text-primary"
      />
      <span className="text-star-navy text-[13px] font-bold dark:text-foreground">{tile.title}</span>
      {tile.description ? (
        <span className="text-muted-foreground line-clamp-2 text-center text-[11px] leading-snug">
          {tile.description}
        </span>
      ) : null}
    </Link>
  );
}

export function Kp2TileGrid({ tiles }: { tiles: Kp2Tile[] }) {
  const singleTile = tiles.length === 1;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3" role="list">
      {tiles.map((tile) => (
        <div
          key={tile.id}
          role="listitem"
          className={singleTile ? "col-span-2 max-w-sm" : undefined}
        >
          <Kp2TileCard tile={tile} />
        </div>
      ))}
    </div>
  );
}
