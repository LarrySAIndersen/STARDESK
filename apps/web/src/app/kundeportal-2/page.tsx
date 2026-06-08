import Link from "next/link";

export default function Kundeportal2Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-[#003087]">Kundeportal #2</h1>
      <p className="mt-3 text-muted-foreground">
        Alternativ selvbetjeningsportal for Service Requests and Changes. Portalindhold
        bygges ud fra kravspecifikationen.
      </p>
      <p className="mt-6">
        <Link href="/portal" className="text-primary underline-offset-4 hover:underline">
          Tilbage til selvbetjening
        </Link>
      </p>
    </main>
  );
}