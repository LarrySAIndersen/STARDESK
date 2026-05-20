import Link from "next/link";
import { Clock } from "lucide-react";

import { CategoryIcon } from "@/components/portal/category/category-icon";
import { Badge } from "@/components/ui/badge";
import type { PortalServiceItem } from "@/lib/portal-category";

export function ServiceCard({ service }: { service: PortalServiceItem }) {
  return (
    <Link
      href={service.href}
      className="portal-v2-card group flex h-full flex-col gap-2 p-4 transition hover:border-star-navy/30 hover:shadow-sm"
    >
      <div className="text-star-navy flex items-start justify-between gap-2">
        <span className="bg-star-navy/6 flex size-9 items-center justify-center rounded-[2px] border border-star-navy/10">
          <CategoryIcon name={service.icon} size={18} />
        </span>
        {service.estimatedTime ? (
          <Badge
            variant="outline"
            className="text-[10px] font-normal tabular-nums"
          >
            <Clock className="mr-1 size-3" aria-hidden />
            {service.estimatedTime}
          </Badge>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-star-navy text-[14px] font-semibold group-hover:text-star-red">
          {service.title}
        </h3>
        <p className="text-[var(--gray-mid)] mt-1 text-[12px] leading-snug">
          {service.description}
        </p>
      </div>
    </Link>
  );
}
