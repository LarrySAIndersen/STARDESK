import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "STARDESK Projekt Kanban",
  description: "Internt projekt-board — uafhængigt af STARdesk deploy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
