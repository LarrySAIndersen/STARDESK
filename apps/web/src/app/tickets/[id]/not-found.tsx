import Link from "next/link";

export default function TicketNotFound() {
  return (
    <main className="star-page max-w-7xl">
      <h1 className="text-star-navy text-xl font-semibold">Sagen findes ikke</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Sagen er slettet, findes ikke i databasen, eller du har fulgt et gammelt link.
        Log ind med en aktiv testbruger (fx sf01@example.dk) og åbn sagen fra oversigten.
      </p>
      <Link href="/" className="text-star-blue mt-4 inline-block text-sm font-medium hover:underline">
        ← Tilbage til sagsoversigt
      </Link>
    </main>
  );
}
