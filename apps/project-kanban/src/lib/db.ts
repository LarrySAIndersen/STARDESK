import { neon } from "@neondatabase/serverless";

export function getSql() {
  const url = process.env.PROJECT_KANBAN_DATABASE_URL;
  if (!url) {
    throw new Error("PROJECT_KANBAN_DATABASE_URL is not set");
  }
  return neon(url);
}

export type PkColumn = {
  id: string;
  name: string;
  position: number;
};

export type PkCard = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type PkColumnWithCards = {
  column: PkColumn;
  cards: PkCard[];
};

export async function fetchBoard(): Promise<PkColumnWithCards[]> {
  const sql = getSql();
  const columnRows = (await sql`
    SELECT id, name, position FROM pk_columns ORDER BY position ASC
  `) as PkColumn[];
  const cardRows = (await sql`
    SELECT id, column_id, title, description, position, created_at, updated_at
    FROM pk_cards ORDER BY column_id, position ASC
  `) as PkCard[];
  const byColumn = new Map<string, PkCard[]>();
  for (const col of columnRows) {
    byColumn.set(col.id, []);
  }
  for (const card of cardRows) {
    byColumn.get(card.column_id)?.push(card);
  }
  return columnRows.map((column) => ({
    column,
    cards: byColumn.get(column.id) ?? [],
  }));
}
