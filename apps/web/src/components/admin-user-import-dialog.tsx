"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { apiPost } from "@/lib/api";
import { parseUserImportCsv } from "@/lib/user-import";
import type { RoleOption, UserImportRequest, UserImportResult } from "@/types/admin-user";
import type { UserRole } from "@/types/user";

const selectClassName =
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AdminUserImportDialog({
  roleOptions,
  currentUserRole,
  onClose,
  onImported,
}: {
  roleOptions: RoleOption[];
  currentUserRole: UserRole;
  onClose: () => void;
  onImported: () => void;
}) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useFocusTrap(true, onClose);

  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<UserImportRequest["rows"]>([]);
  const [defaultRole, setDefaultRole] = useState<UserImportRequest["default_role"]>("end_user");
  const [onDuplicate, setOnDuplicate] = useState<UserImportRequest["on_duplicate"]>("skip");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UserImportResult | null>(null);

  const roleChoices = roleOptions.filter(
    (role) => currentUserRole === "top_admin" || role.value !== "top_admin",
  );

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
    const parsed = parseUserImportCsv(text);
    setFileName(file.name);
    setParsedRows(parsed.rows);
    setRowCount(parsed.rows.length);
    setParseErrors(parsed.errors);
  };

  const onImport = async () => {
    if (parsedRows.length === 0) {
      setError("Vælg en CSV-fil med mindst én bruger");
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const payload: UserImportRequest = {
        rows: parsedRows,
        default_role: defaultRole,
        on_duplicate: onDuplicate,
      };
      const response = await apiPost<UserImportResult>("/api/v1/users/import", payload);
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
            Importer brugere
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Luk">
            ✕
          </Button>
        </div>

        <p className="text-muted-foreground mt-2 text-sm">
          Upload en CSV fra TOPdesk eller Excel. Kolonner: e-mail, navn, rolle (valgfri), grupper
          (komma/semikolon), organisation (valgfri), aktiv (valgfri).
        </p>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-import-file">CSV-fil</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="user-import-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => void onFileChange(event)}
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
                  {fileName} — {rowCount} række{rowCount === 1 ? "" : "r"}
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
              <Label htmlFor="user-import-default-role">Standardrolle</Label>
              <select
                id="user-import-default-role"
                className={selectClassName}
                value={defaultRole}
                onChange={(event) =>
                  setDefaultRole(event.target.value as UserImportRequest["default_role"])
                }
              >
                {roleChoices.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-import-duplicate">Eksisterende e-mail</Label>
              <select
                id="user-import-duplicate"
                className={selectClassName}
                value={onDuplicate}
                onChange={(event) =>
                  setOnDuplicate(event.target.value as UserImportRequest["on_duplicate"])
                }
              >
                <option value="skip">Spring over</option>
                <option value="update">Opdater bruger</option>
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
                      {rowError.email ? ` (${rowError.email})` : ""}: {rowError.message}
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
              onClick={() => void onImport()}
            >
              {importing ? "Importerer…" : "Importer"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
