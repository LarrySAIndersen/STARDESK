export function PageHero({
  title,
  lead,
}: {
  title: string;
  lead: string;
}) {
  return (
    <header className="star-hero">
      <h1 className="star-hero-title">{title}</h1>
      <p className="star-hero-lead">{lead}</p>
    </header>
  );
}
