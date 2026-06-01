---
name: stardesk-deliverable-gate
description: ALWAYS run before marking any STARDESK work complete. Mandatory hello-world gate — bash scripts/run-deliverable-gate.sh (add --full for UI). Login Anna sf01@example.dk, Alle sager, non-production /health. Use on every PR, Cloud Agent task, and handoff without exception.
---

# STARDESK deliverable gate

Run **before** you mark work complete or open/update a PR.

## Quick gate (required always)

```bash
bash scripts/run-deliverable-gate.sh
```

Prerequisites: `bash scripts/dev-up.sh` (or API :8000 + Web :3000), database bootstrapped.

## Full gate (UI changes, auth, routing, portal, tickets)

```bash
bash scripts/run-deliverable-gate.sh --full
```

## Staging hello-world (after merge to `staging` or before prod)

```bash
bash scripts/run-deliverable-gate.sh --staging
bash scripts/run-deliverable-gate.sh --staging --full
```

Windows: `pwsh -File scripts/run-deliverable-gate.ps1 -Staging` (add `-Full` for UI on staging Preview).

## Checklist

- [ ] `GET /health` shows intended `stardesk_env` (local = `development`, not `production`)
- [ ] Login `sf01@example.dk` / `Stardesk2026!`
- [ ] At least one ticket in API and on `/tickets` (demo labels)
- [ ] After merge to **staging**: `--staging` / `-Staging` passed (cloud Preview)
- [ ] Attach gate output (+ screenshots from `--full`) to PR description

Full reference: `docs/deliverable-gate.md`
