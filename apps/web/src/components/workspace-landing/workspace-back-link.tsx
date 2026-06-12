"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type WorkspaceBackLinkProps = Readonly<{
  href: string;
  label: string;
  className?: string;
}>;

export function WorkspaceBackLink({ href, label, className }: WorkspaceBackLinkProps) {
  return (
    <Link href={href} className={cn("workspace-back-link", className)}>
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
