import { NextResponse } from "next/server";

import {
  getServerIntegrations,
  replaceServerIntegrations,
} from "@/lib/integrations-mock-store";
import type { IntegrationsState } from "@/types/integration";

export async function GET() {
  return NextResponse.json(getServerIntegrations());
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as IntegrationsState;
    return NextResponse.json(replaceServerIntegrations(body));
  } catch {
    return NextResponse.json({ detail: "Ugyldigt JSON" }, { status: 400 });
  }
}
