import Link from "next/link";
import { Heart, Share2, Star } from "lucide-react";

import { formatKp2Date } from "@/lib/kundeportal-2/mock-data";
import type { Kp2ServiceMessage } from "@/lib/kundeportal-2/types";
import { KP2_BASE } from "@/lib/kundeportal-2/types";

const STATUS_LABELS: Record<Kp2ServiceMessage["status"], string> = {
  behandler: "Behandler",
  loest: "Løst",
  planlagt: "Planlagt",
  publiceret: "Publiceret",
};

export function Kp2ServiceMessageDetail({ message }: { message: Kp2ServiceMessage }) {
  const isNews = message.tone === "news";

  return (
    <div className="kp2-page mx-auto max-w-4xl space-y-6 p-4 pb-12 sm:p-6">
      <header className="space-y-1">
        {isNews ? (
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--kp2-turkis)]">
            {message.bannerLabel}
          </p>
        ) : null}
        <h1 className="kp2-page-title">{message.title}</h1>
        <p className="text-muted-foreground text-sm">
          {isNews ? "Udgivet" : "Registreret"} {formatKp2Date(message.registeredAt)}
        </p>
      </header>

      {isNews && message.heroImage ? (
        <figure className="kp2-news-hero overflow-hidden rounded-sm border border-border shadow-sm">
          <img src={message.heroImage} alt="" className="w-full object-cover" />
        </figure>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4">
          <article className="kp2-card p-4 sm:p-5">
            {!isNews ? (
              <div className="mb-3 flex items-center gap-3">
                <div className="kp2-message-icon" aria-hidden>!</div>
                <div>
                  <h2 className="font-semibold">{message.bannerLabel}</h2>
                  <p className="text-muted-foreground text-xs">
                    Registreret {formatKp2Date(message.registeredAt)}
                  </p>
                </div>
              </div>
            ) : null}
            <p className="text-base leading-relaxed">{message.summary}</p>

            {isNews && message.pullQuote ? (
              <blockquote className="kp2-news-quote mt-4">
                <Star className="mb-2 size-5 text-[var(--kp2-turkis)]" aria-hidden />
                <p className="text-lg font-medium leading-snug">{message.pullQuote}</p>
              </blockquote>
            ) : null}
          </article>

          {message.sections?.map((section, index) => (
            <article key={index} className="kp2-card p-4 sm:p-5">
              {section.heading ? (
                <h2 className="mb-2 text-lg font-semibold text-[var(--kp2-blue)]">
                  {section.heading}
                </h2>
              ) : null}
              <p className="text-sm leading-relaxed">{section.body}</p>
            </article>
          ))}

          {message.gallery && message.gallery.length > 0 ? (
            <section className="space-y-3" aria-label="Billedgalleri">
              <h2 className="text-lg font-semibold text-[var(--kp2-blue)]">Billeder</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {message.gallery.map((image) => (
                  <figure
                    key={image.src}
                    className="kp2-news-gallery-item overflow-hidden rounded-sm border border-border bg-white"
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-40 w-full object-cover sm:h-44"
                    />
                    {image.caption ? (
                      <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                        {image.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label={isNews ? "Seneste reaktioner" : "Opdateringer"}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {isNews ? "Seneste reaktioner" : "Opdateringer"}
            </h2>
            {message.updates.map((update) => (
              <article key={update.id} className="kp2-update-card">
                <div className="kp2-update-avatar" aria-hidden />
                <div>
                  <p className="text-sm font-medium">
                    {update.author}{" "}
                    <span className="text-muted-foreground font-normal">
                      {formatKp2Date(update.createdAt)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{update.body}</p>
                </div>
              </article>
            ))}
          </section>
        </div>

        <aside className="space-y-4">
          <div
            className={
              isNews
                ? "kp2-status-badge kp2-status-badge--news"
                : "kp2-status-badge"
            }
          >
            {STATUS_LABELS[message.status]}
          </div>
          {isNews ? (
            <button type="button" className="kp2-btn-primary w-full gap-2">
              <Heart className="size-4" aria-hidden />
              Jeg elsker også STARDESK
            </button>
          ) : (
            <button type="button" className="kp2-btn-primary w-full">
              Jeg er paavirket af denne afbrydelse
            </button>
          )}
          {isNews ? (
            <button type="button" className="kp2-btn-secondary w-full gap-2">
              <Share2 className="size-4" aria-hidden />
              Del nyheden
            </button>
          ) : null}
          <dl className="kp2-card space-y-2 p-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{message.type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kategorisering</dt>
              <dd>{message.categorization}</dd>
            </div>
          </dl>
          <Link href={KP2_BASE} className="text-primary text-sm underline">
            Tilbage til forsiden
          </Link>
        </aside>
      </div>
    </div>
  );
}
