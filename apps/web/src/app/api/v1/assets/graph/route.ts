import { NextResponse } from "next/server";

import { buildAssetGraph } from "@/lib/asset-graph";

export async function GET() {
  return NextResponse.json(buildAssetGraph());
}
