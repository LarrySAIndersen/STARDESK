import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-helpdesk-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-helpdesk-serif",
});

export const metadata: Metadata = {
  title: "STAR Help Desk — Velkommen",
  description: "STAR Help Desk login og selvbetjening",
};

export default function HelpdeskLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${sourceSans.variable} ${sourceSerif.variable} flex min-h-dvh flex-1 flex-col`}
      style={{
        fontFamily: "var(--font-helpdesk-sans), 'Source Sans 3', sans-serif",
      }}
    >
      {children}
    </div>
  );
}
