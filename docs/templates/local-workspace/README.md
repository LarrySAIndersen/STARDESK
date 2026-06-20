# Lokal STARDESK CURSOR workspace — installation

Kopiér disse filer til din **Windows**-mappe `STARDESK CURSOR` (workspace-rod — samme niveau som `STARDESK`, `Golden set`, osv.).

## Trin

1. **Workspace-fil**

   ```text
   STARDESK-Cursor.code-workspace.example  →  ../STARDESK-Cursor.code-workspace
   ```

   Ret stier i filen hvis dine mappenavne afviger.

2. **Workspace-regel**

   ```text
   cursor-rules/stardesk-workspace-root.mdc  →  ../.cursor/rules/stardesk-workspace-root.mdc
   ```

   Opret mappen `.cursor/rules` i workspace-roden hvis den ikke findes.

3. **Åbn i Cursor**

   File → Open Workspace from File → vælg `STARDESK-Cursor.code-workspace`.

4. **Hoved-repo**

   Mappen `STARDESK` skal være git-klon af star-itsm-cloud. Repoets egne regler i `STARDESK/.cursor/rules` gælder automatisk når du arbejder i den mappe.

Se også: [docs/agent-harness.md](../../agent-harness.md)
