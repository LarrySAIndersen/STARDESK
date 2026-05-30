import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { column_id?: string; position?: number };
  if (!body.column_id) {
    return NextResponse.json({ error: "column_id required" }, { status: 400 });
  }

  const sql = getSql();
  let position = body.position;
  if (position === undefined) {
    const maxPos = await sql`
      SELECT MAX(position) AS max FROM pk_cards WHERE column_id = ${body.column_id}::uuid
    `;
    const max = (maxPos[0] as { max: number | null } | undefined)?.max;
    position = (max ?? -1) + 1;
  }

  await sql`
    UPDATE pk_cards
    SET column_id = ${body.column_id}::uuid, position = ${position}, updated_at = NOW()
    WHERE id = ${id}::uuid
  `;

  const rows = await sql`
    SELECT id, column_id, title, description, position, created_at, updated_at
    FROM pk_cards WHERE id = ${id}::uuid
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
