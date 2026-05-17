import Link from "next/link";

import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          STARdesk
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm"
          >
            Sager
          </Link>
          <Button nativeButton={false} render={<Link href="/tickets/new" />}>
            Opret sag
          </Button>
        </nav>
      </div>
    </header>
  );
}

