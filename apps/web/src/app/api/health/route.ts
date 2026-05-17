import { NextResponse } from "next/server";

/** Liveness probe for load balancers / uptime checks (no Basic Auth challenge). */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
