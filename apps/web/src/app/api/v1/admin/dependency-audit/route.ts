import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth-server";
import { isAdmin } from "@/lib/auth";
import {
  getAuditReportPreferCache,
  getCachedAuditReport,
  mockAuditReport,
  refreshAuditReport,
} from "@/lib/dependency-audit-server";
import type { DependencyAuditReport } from "@/types/dependency-audit";

async function requireAdminUser() {
  const user = await getServerUser();
  if (!isAdmin(user)) {
    return null;
  }
  return user;
}

function respond(report: DependencyAuditReport, status = 200) {
  return NextResponse.json(report, { status });
}

export async function GET() {
  const user = await requireAdminUser();
  if (!user) {
    return NextResponse.json({ detail: "Kun administratorer har adgang" }, { status: 403 });
  }

  const cached = getAuditReportPreferCache();
  if (cached) {
    return respond(cached);
  }

  const stale = getCachedAuditReport();
  if (stale) {
    return respond({ ...stale, source: "cache" });
  }

  return respond(mockAuditReport());
}

export async function POST() {
  const user = await requireAdminUser();
  if (!user) {
    return NextResponse.json({ detail: "Kun administratorer har adgang" }, { status: 403 });
  }

  const { report, refreshed } = await refreshAuditReport(true);
  return respond({
    ...report,
    source: refreshed ? "live" : report.source,
  });
}
