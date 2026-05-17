import { cn } from "@/lib/utils";

type SectionVariant = "default" | "accent" | "navy" | "alert";

export function StarSectionCard({
  title,
  description,
  variant = "default",
  children,
  className,
}: {
  title: string;
  description?: string;
  variant?: SectionVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const headerClass =
    variant === "navy"
      ? "star-section-header--navy"
      : variant === "alert"
        ? "star-section-header--alert"
        : "star-section-header";

  return (
    <section
      className={cn(
        "star-section-card",
        variant === "accent" && "star-section-card--accent",
        className,
      )}
    >
      <div className={headerClass}>
        <h2 className="star-section-title">{title}</h2>
        {description ? <p className="star-section-desc">{description}</p> : null}
      </div>
      <div className="star-section-body">{children}</div>
    </section>
  );
}
