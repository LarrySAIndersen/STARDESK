import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; position?: number };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const sql = getSql();
  const id = randomUUID();
  let position = body.position;
  if (position === undefined) {
    const maxPos = await sql`
      SELECT MAX(position) AS max FROM pk_columns
    `;
    position = ((maxPos[0] as { max: number | null } | undefined)?.max ?? -1) + 1;
  } else {
    await sql`
      UPDATE pk_columns SET position = position + 1 WHERE position >= ${position}
    `;
  }

  await sql`
    INSERT INTO pk_columns (id, name, position) VALUES (${id}::uuid, ${name}, ${position})
  `;

  const rows = await sql`SELECT id, name, position FROM pk_columns WHERE id = ${id}::uuid`;
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as { id?: string; name?: string };
  if (!body.id || !body.name?.trim()) {
    return NextResponse.json({ error: "id and name required" }, { status: 400 });
  }
  const sql = getSql();
  await sql`UPDATE pk_columns SET name = ${body.name.trim()} WHERE id = ${body.id}::uuid`;
  const rows = await sql`SELECT id, name, position FROM pk_columns WHERE id = ${body.id}::uuid`;
  return NextResponse.json(rows[0]);
}
