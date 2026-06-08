import Link from "next/link";

import { Kp2Icon } from "@/components/kundeportal-2/kp2-icon";
import type { Kp2Tile } from "@/lib/kundeportal-2/types";

export function Kp2TileCard({ tile }: { tile: Kp2Tile }) {
  return (
    <Link href={tile.href} className="kp2-tile group">
      <Kp2Icon name={tile.icon} className="kp2-tile-icon size-10" />
      <span className="kp2-tile-label">{tile.title}</span>
    </Link>
  );
}

export function Kp2TileGrid({ tiles }: { tiles: Kp2Tile[] }) {
  return (
    <div className="kp2-tile-grid" role="list">
      {tiles.map((tile) => (
        <div key={tile.id} role="listitem">
          <Kp2TileCard tile={tile} />
        </div>
      ))}
    </div>
  );
}
