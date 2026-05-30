# Work Board canvas (git mirror)

Canonical live files for Cursor Canvas:

- `~/.cursor/projects/.../canvases/stardesk-workboard.canvas.tsx`
- `stardesk-workboard.canvas.data.json` (UI cache — do not commit tokens)

This folder mirrors `stardesk-workboard.canvas.tsx` for version control. After editing the canvas in Cursor, copy the TSX here before commit:

```powershell
Copy-Item "$env:USERPROFILE\.cursor\projects\c-Users-kjaer-STARDESK-Cursor\canvases\stardesk-workboard.canvas.tsx" `
  "STARDESK/workboard/stardesk-workboard.canvas.tsx"
```

See `docs/agent-review-ac-matrix.md` and `docs/stardesk-agent-review-skill.md`.
