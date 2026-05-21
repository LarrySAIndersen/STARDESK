import type { UserImportRowInput } from "@/types/admin-user";

const HEADER_ALIASES: Record<keyof UserImportRowInput, string[]> = {
  email: ["email", "e-mail", "e_mail", "mail", "epost", "e-post"],
  display_name: [
    "display_name",
    "name",
    "navn",
    "full_name",
    "fuldenavn",
    "fulde_navn",
    "bruger",
    "person",
  ],
  role: ["role", "rolle", "rettighed", "rettighedsgruppe"],
  is_active: ["is_active", "aktiv", "active", "status", "enabled"],
  teams: ["teams", "grupper", "groups", "gruppe", "team", "operator_group"],
  organization: ["organization", "organisation", "org", "afdeling", "branch"],
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

function mapHeaders(headers: string[]): Partial<Record<keyof UserImportRowInput, number>> {
  const mapping: Partial<Record<keyof UserImportRowInput, number>> = {};
  const normalized = headers.map(normalizeHeader);

  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof UserImportRowInput,
    string[],
  ][]) {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) {
      mapping[field] = index;
    }
  }

  return mapping;
}

export type ParsedUserImport = {
  rows: UserImportRowInput[];
  errors: string[];
};

export function parseUserImportCsv(text: string): ParsedUserImport {
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

  if (columnMap.email === undefined) {
    return {
      rows: [],
      errors: [
        "CSV skal have en kolonne for e-mail (fx email, e-mail eller mail)",
      ],
    };
  }
  if (columnMap.display_name === undefined) {
    return {
      rows: [],
      errors: [
        "CSV skal have en kolonne for navn (fx display_name, name eller navn)",
      ],
    };
  }

  const rows: UserImportRowInput[] = [];
  const errors: string[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = splitCsvLine(lines[lineIndex]!, delimiter);
    const read = (field: keyof UserImportRowInput): string | undefined => {
      const index = columnMap[field];
      if (index === undefined) {
        return undefined;
      }
      const value = cells[index]?.trim();
      return value ? value : undefined;
    };

    const email = read("email");
    const display_name = read("display_name");
    if (!email && !display_name) {
      continue;
    }
    if (!email || !display_name) {
      errors.push(`Række ${lineIndex + 1}: mangler e-mail eller navn`);
      continue;
    }

    rows.push({
      email,
      display_name,
      role: read("role"),
      is_active: read("is_active"),
      teams: read("teams"),
      organization: read("organization"),
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("Ingen gyldige datarækker fundet");
  }

  return { rows, errors };
}
