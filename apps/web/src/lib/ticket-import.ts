import type { TicketImportRowInput } from "@/types/admin-import";

const HEADER_ALIASES: Record<keyof TicketImportRowInput, string[]> = {
  title: ["title", "titel", "emne", "subject", "summary", "kort_beskrivelse"],
  description: [
    "description",
    "beskrivelse",
    "memo",
    "note",
    "notes",
    "detaljer",
    "body",
    "indhold",
  ],
  ticket_type: ["ticket_type", "type", "sagstype", "calltype", "call_type"],
  priority: ["priority", "prioritet", "urgency", "impact"],
  status: ["status", "statusnavn", "state", "tilstand"],
  external_number: [
    "external_number",
    "sagsnr",
    "sagsnummer",
    "ticket_number",
    "number",
    "incident_number",
    "call_number",
    "id",
  ],
  category: ["category", "kategori", "category_name", "service"],
  team: ["team", "gruppe", "group", "operator_group", "behandl_gruppe"],
  reporter_email: [
    "reporter_email",
    "indmelder",
    "caller",
    "caller_email",
    "requester",
    "requester_email",
    "email",
  ],
  is_major: ["is_major", "stor_sag", "major", "store_sag"],
  source: ["source", "kilde", "origin", "kanal"],
};

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/\s+/g, "_");
}

function detectDelimiter(line: string): "," | ";" {
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && char === delimiter) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function mapHeaders(headers: string[]): Partial<Record<keyof TicketImportRowInput, number>> {
  const mapping: Partial<Record<keyof TicketImportRowInput, number>> = {};
  const normalized = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof TicketImportRowInput,
    string[],
  ][]) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      mapping[field] = index;
    }
  }

  return mapping;
}

function rowFromRecord(
  record: Record<string, unknown>,
  rowIndex: number,
  errors: string[],
): TicketImportRowInput | null {
  const pick = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const raw = record[key];
      if (raw === undefined || raw === null) {
        continue;
      }
      const text = String(raw).trim();
      if (text) {
        return text;
      }
    }
    return undefined;
  };

  const title =
    pick("title", "titel", "emne", "subject") ??
    pick("Title", "Titel");
  if (!title) {
    errors.push(`Række ${rowIndex}: mangler titel`);
    return null;
  }

  return {
    title,
    description: pick("description", "beskrivelse", "memo", "note"),
    ticket_type: pick("ticket_type", "type", "sagstype"),
    priority: pick("priority", "prioritet"),
    status: pick("status", "statusnavn"),
    external_number: pick(
      "external_number",
      "sagsnr",
      "ticket_number",
      "number",
      "call_number",
    ),
    category: pick("category", "kategori"),
    team: pick("team", "gruppe", "operator_group"),
    reporter_email: pick("reporter_email", "indmelder", "caller_email", "email"),
    is_major: pick("is_major", "stor_sag", "major"),
    source: pick("source", "kilde"),
  };
}

export type ParsedTicketImport = {
  rows: TicketImportRowInput[];
  errors: string[];
};

export function parseTicketImportCsv(text: string): ParsedTicketImport {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ["Filen er tom"] };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headerCells = splitCsvLine(lines[0]!, delimiter);
  const columnMap = mapHeaders(headerCells);

  if (columnMap.title === undefined) {
    return {
      rows: [],
      errors: ["CSV skal have en kolonne for titel (fx title, titel eller emne)"],
    };
  }

  const rows: TicketImportRowInput[] = [];
  const errors: string[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex]!, delimiter);
    const read = (field: keyof TicketImportRowInput): string | undefined => {
      const index = columnMap[field];
      if (index === undefined) {
        return undefined;
      }
      const value = cells[index]?.trim();
      return value ? value : undefined;
    };

    const title = read("title");
    if (!title) {
      continue;
    }

    rows.push({
      title,
      description: read("description"),
      ticket_type: read("ticket_type"),
      priority: read("priority"),
      status: read("status"),
      external_number: read("external_number"),
      category: read("category"),
      team: read("team"),
      reporter_email: read("reporter_email"),
      is_major: read("is_major"),
      source: read("source"),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Ingen gyldige datarækker fundet");
  }

  return { rows, errors };
}

export function parseTicketImportJson(text: string): ParsedTicketImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], errors: ["Ugyldig JSON"] };
  }

  let records: Record<string, unknown>[] = [];
  if (Array.isArray(parsed)) {
    records = parsed.filter((item) => item && typeof item === "object") as Record<
      string,
      unknown
    >[];
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const candidate =
      obj.tickets ?? obj.sager ?? obj.items ?? obj.data ?? obj.incidents ?? obj.calls;
    if (Array.isArray(candidate)) {
      records = candidate.filter((item) => item && typeof item === "object") as Record<
        string,
        unknown
      >[];
    }
  }

  if (records.length === 0) {
    return {
      rows: [],
      errors: [
        "JSON skal være en liste af sager, eller et objekt med fx tickets/sager/items",
      ],
    };
  }

  const rows: TicketImportRowInput[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      normalized[normalizeHeader(key)] = value;
    }
    const row = rowFromRecord(normalized, index + 1, errors);
    if (row) {
      rows.push(row);
    }
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Ingen gyldige sager i JSON");
  }

  return { rows, errors };
}
