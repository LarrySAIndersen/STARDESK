import { NextResponse } from "next/server";

import { patchServerIntegration } from "@/lib/integrations-mock-store";
import type { IntegrationId } from "@/types/integration";

const VALID_IDS: IntegrationId[] = ["slack", "jira", "topdesk"];

function isIntegrationId(value: string): value is IntegrationId {
  return VALID_IDS.includes(value as IntegrationId);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isIntegrationId(id)) {
    return NextResponse.json({ detail: "Ukendt integration" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const next = patchServerIntegration(id, body);
    return NextResponse.json(next);
  } catch {
    return NextResponse.json({ detail: "Ugyldigt JSON" }, { status: 400 });
  }
}
