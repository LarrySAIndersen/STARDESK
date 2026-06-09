import Link from "next/link";

import { AlertCircle, ChevronRight, Star } from "lucide-react";



import type { Kp2ServiceMessage } from "@/lib/kundeportal-2/types";

import { KP2_BASE } from "@/lib/kundeportal-2/types";

import { cn } from "@/lib/utils";



export function Kp2ServiceMessageBanner({ message }: { message: Kp2ServiceMessage }) {

  const isNews = message.tone === "news";



  return (

    <aside

      className={cn(

        "portal-v2-card overflow-hidden lg:sticky lg:top-4",

        isNews ? "border-t-star-navy dark:border-t-primary" : "border-t-star-red",

      )}

      aria-labelledby="kp2-message-heading"

    >

      <div

        className={cn(

          "flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white",

          isNews ? "bg-star-navy dark:bg-primary" : "bg-star-red",

        )}

      >

        {isNews ? (

          <Star className="size-4 shrink-0 fill-current" aria-hidden />

        ) : (

          <AlertCircle className="size-4 shrink-0" aria-hidden />

        )}

        <h2 id="kp2-message-heading">{message.bannerLabel}</h2>

      </div>

      <Link

        href={`${KP2_BASE}/driftsmeddelelse/${message.id}`}

        className="hover:bg-accent/40 group block p-3 transition-colors"

      >

        {isNews && message.heroImage ? (

          <img

            src={message.heroImage}

            alt=""

            className="mb-2 aspect-[2/1] w-full rounded-[2px] object-cover"

          />

        ) : null}

        <p className="text-foreground text-sm font-semibold leading-snug">{message.title}</p>

        <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{message.summary}</p>

        <p className="text-star-red group-hover:text-star-navy mt-3 flex items-center gap-1 text-xs font-semibold transition-colors dark:group-hover:text-primary">

          Læs mere

          <ChevronRight className="size-3.5" aria-hidden />

        </p>

      </Link>

    </aside>

  );

}

