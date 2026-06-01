"use client";

import { fireAndForget } from "@/lib/fire-and-forget";

import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPost } from "@/lib/api";
import { parseTicketImportCsv, parseTicketImportJson } from "@/lib/ticket-import";
import type {
  TicketImportRequest,
  TicketImportResult,
  TicketImportRowInput,
} from "@/types/admin-import";

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AdminTicketImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useFocusTrap(true, onClose);

  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<TicketImportRowInput[]>([]);
  const [defaultTicketType, setDefaultTicketType] =
    useState<TicketImportRequest["default_ticket_type"]>("incident");
  const [defaultPriority, setDefaultPriority] =
    useState<TicketImportRequest["default_priority"]>("medium");
  const [onDuplicate, setOnDuplicate] = useState<TicketImportRequest["on_duplicate"]>("skip");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TicketImportResult | null>(null);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setResult(null);
    setError(null);
    if (!file) {
      setFileName(null);
      setRowCount(0);
      setParsedRows([]);
      setParseErrors([]);
      return;
    }

    const text = await file.text();
    const isJson = format === "json" || file.name.toLowerCase().endsWith(".json");
    const parsed = isJson ? parseTicketImportJson(text) : parseTicketImportCsv(text);
    setFileName(file.name);
    setParsedRows(parsed.rows);
    setRowCount(parsed.rows.length);
    setParseErrors(parsed.errors);
  };

  const onImport = async () => {
    if (parsedRows.length === 0) {
      setError("Vælg en fil med mindst én sag");
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const payload: TicketImportRequest = {
        rows: parsedRows,
        default_ticket_type: defaultTicketType,
        default_priority: defaultPriority,
        on_duplicate: onDuplicate,
      };
      const response = await apiPost<TicketImportResult>(
        "/api/v1/admin/tickets/import",
        payload,
      );
      setResult(response);
      if (response.created > 0 || response.updated > 0) {
        onImported();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import mislykkedes");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-background max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-star-navy text-lg font-semibold">
            Importer TOPdesk-sager
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Luk">
            ✕
          </Button>
        </div>

        <p className="text-muted-foreground mt-2 text-sm">
          Upload CSV eller JSON fra TOPdesk. Kolonner: titel, beskrivelse, sagsnummer, status,
          prioritet, kategori, gruppe, indmelder (e-mail).
        </p>

        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={format === "csv" ? "default" : "outline"}
              className={format === "csv" ? "bg-star-blue hover:bg-star-navy" : ""}
              onClick={() => {
                setFormat("csv");
                setParsedRows([]);
                setFileName(null);
                setRowCount(0);
                setParseErrors([]);
              }}
            >
              CSV
            </Button>
            <Button
              type="button"
              variant={format === "json" ? "default" : "outline"}
              className={format === "json" ? "bg-star-blue hover:bg-star-navy" : ""}
              onClick={() => {
                setFormat("json");
                setParsedRows([]);
                setFileName(null);
                setRowCount(0);
                setParseErrors([]);
              }}
            >
              JSON
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-import-file">Fil</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="ticket-import-file"
                type="file"
                accept={format === "json" ? ".json,application/json" : ".csv,text/csv"}
                className="sr-only"
                onChange={(event) => fireAndForget(onFileChange(event))}
              />
              <Button
                type="button"
                variant="outline"
                className="border-star-navy text-star-navy"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" aria-hidden />
                Vælg fil
              </Button>
              {fileName ? (
                <span className="text-muted-foreground text-sm">
                  {fileName} — {rowCount} sag{rowCount === 1 ? "" : "er"}
                </span>
              ) : null}
            </div>
            {parseErrors.length > 0 ? (
              <ul className="text-destructive list-inside list-disc text-xs">
                {parseErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-import-type">Standardsagstype</Label>
              <select
                id="ticket-import-type"
                className={selectClassName}
                value={defaultTicketType}
                onChange={(event) =>
                  setDefaultTicketType(
                    event.target.value as TicketImportRequest["default_ticket_type"],
                  )
                }
              >
                <option value="incident">Hændelse</option>
                <option value="service_request">Serviceanmodning</option>
                <option value="problem">Problem</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-import-priority">Standardprioritet</Label>
              <select
                id="ticket-import-priority"
                className={selectClassName}
                value={defaultPriority}
                onChange={(event) =>
                  setDefaultPriority(
                    event.target.value as TicketImportRequest["default_priority"],
                  )
                }
              >
                <option value="critical">Kritisk</option>
                <option value="high">Høj</option>
                <option value="medium">Mellem</option>
                <option value="low">Lav</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ticket-import-duplicate">Eksisterende sagsnummer</Label>
              <select
                id="ticket-import-duplicate"
                className={selectClassName}
                value={onDuplicate}
                onChange={(event) =>
                  setOnDuplicate(event.target.value as TicketImportRequest["on_duplicate"])
                }
              >
                <option value="skip">Spring over</option>
                <option value="update">Opdater sag</option>
              </select>
            </div>
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {result ? (
            <div className="wire-card mb-0 text-sm">
              <p>
                <span className="font-semibold">{result.created}</span> oprettet ·{" "}
                <span className="font-semibold">{result.updated}</span> opdateret ·{" "}
                <span className="font-semibold">{result.skipped}</span> sprunget over ·{" "}
                <span className="font-semibold">{result.failed}</span> fejl
              </p>
              {result.errors.length > 0 ? (
                <ul className="text-destructive mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs">
                  {result.errors.map((rowError) => (
                    <li key={`${rowError.row}-${rowError.message}`}>
                      Række {rowError.row}
                      {rowError.external_number ? ` (${rowError.external_number})` : ""}:{" "}
                      {rowError.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {result ? "Luk" : "Annuller"}
            </Button>
            <Button
              type="button"
              className="bg-star-blue hover:bg-star-navy"
              disabled={importing || parsedRows.length === 0}
              onClick={() => fireAndForget(onImport())}
            >
              {importing ? "Importerer…" : "Importer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
