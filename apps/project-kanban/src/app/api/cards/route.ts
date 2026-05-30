import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getSql } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; column_id?: string; description?: string };
  const title = body.title?.trim();
  const columnId = body.column_id;
  if (!title || !columnId) {
    return NextResponse.json({ error: "title and column_id required" }, { status: 400 });
  }

  const sql = getSql();
  const id = randomUUID();
  const maxPos = await sql`
    SELECT MAX(position) AS max FROM pk_cards WHERE column_id = ${columnId}::uuid
  `;
  const max = (maxPos[0] as { max: number | null } | undefined)?.max;
  const position = (max ?? -1) + 1;

  await sql`
    INSERT INTO pk_cards (id, column_id, title, description, position)
    VALUES (${id}::uuid, ${columnId}::uuid, ${title}, ${body.description?.trim() || null}, ${position})
  `;

  const rows = await sql`
    SELECT id, column_id, title, description, position, created_at, updated_at
    FROM pk_cards WHERE id = ${id}::uuid
  `;
  return NextResponse.json(rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    title?: string;
    description?: string | null;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sql = getSql();
  if (body.title !== undefined) {
    await sql`UPDATE pk_cards SET title = ${body.title.trim()}, updated_at = NOW() WHERE id = ${body.id}::uuid`;
  }
  if (body.description !== undefined) {
    await sql`UPDATE pk_cards SET description = ${body.description}, updated_at = NOW() WHERE id = ${body.id}::uuid`;
  }

  const rows = await sql`
    SELECT id, column_id, title, description, position, created_at, updated_at
    FROM pk_cards WHERE id = ${body.id}::uuid
  `;
  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const sql = getSql();
  await sql`DELETE FROM pk_cards WHERE id = ${id}::uuid`;
  return new NextResponse(null, { status: 204 });
}
