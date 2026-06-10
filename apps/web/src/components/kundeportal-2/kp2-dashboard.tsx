import Link from "next/link";



import { Kp2GlobalSearch } from "@/components/kundeportal-2/kp2-header";

import { Kp2ServiceMessageBanner } from "@/components/kundeportal-2/kp2-service-message-banner";

import { Kp2TileGrid } from "@/components/kundeportal-2/kp2-tile-grid";

import { KP2_FEATURED_TILES, KP2_SERVICE_MESSAGES } from "@/lib/kundeportal-2/mock-data";

import { KP2_BASE } from "@/lib/kundeportal-2/types";

import type { Kp2Tile } from "@/lib/kundeportal-2/types";



const TILE_GROUPS: { id: Kp2Tile["group"]; title: string }[] = [

  { id: "sager", title: "Mine sager & statistik" },

  { id: "opret", title: "Opret sag" },

  { id: "katalog", title: "Katalog" },

];



function groupTiles(tiles: Kp2Tile[]) {

  return TILE_GROUPS.map((group) => ({

    ...group,

    tiles: tiles.filter((tile) => tile.group === group.id),

  })).filter((group) => group.tiles.length > 0);

}



export function Kp2Dashboard() {

  const message = KP2_SERVICE_MESSAGES[0];

  const groups = groupTiles(KP2_FEATURED_TILES);



  return (

    <div className="portal-v2-page mx-auto w-full max-w-5xl space-y-6 pb-10">

      <section className="wire-portal-hero">

        <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">

          Styrelsen for Arbejdsmarked og Rekruttering

        </p>

        <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">

          Kundeportal #2

        </h1>

        <p className="mt-1 max-w-xl text-[13px] text-white/75">

          Genveje til de mest brugte funktioner. Fuldt katalog under{" "}

          <Link

            href={`${KP2_BASE}/service-requests`}

            className="font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"

          >

            Service Requests & Changes

          </Link>

          .

        </p>

        <div className="mt-4">

          <Kp2GlobalSearch className="max-w-md" />

        </div>

      </section>



      <div className="grid gap-6 lg:grid-cols-[minmax(0,220px)_1fr] lg:items-start">

        {message ? <Kp2ServiceMessageBanner message={message} /> : null}



        <div className="space-y-8">

          {groups.map((group) => (

            <section key={group.id} aria-labelledby={`kp2-group-${group.id}`}>

              <h2 id={`kp2-group-${group.id}`} className="wire-sec-title mb-3">

                {group.title}

              </h2>

              <Kp2TileGrid tiles={group.tiles} />

            </section>

          ))}

        </div>

      </div>

    </div>

  );

}

