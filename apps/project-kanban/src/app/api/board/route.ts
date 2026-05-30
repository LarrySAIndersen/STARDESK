import { NextResponse } from "next/server";

import { fetchBoard } from "@/lib/db";

export async function GET() {
  try {
    const board = await fetchBoard();
    return NextResponse.json(board);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
