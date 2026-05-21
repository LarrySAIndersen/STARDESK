import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";

import { AgentShellWrapper } from "@/components/agent/agent-shell-wrapper";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SkipLink } from "@/components/skip-link";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "STARdesk — Sagsstyring",
  description: "STAR ITSM cloud prototype",
  icons: {
    icon: [{ url: "/images/star-logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/images/star-logo.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} font-sans flex min-h-dvh flex-col overflow-x-hidden antialiased`}
      >
        <ThemeProvider>
          <SkipLink />
          <AgentShellWrapper>{children}</AgentShellWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
