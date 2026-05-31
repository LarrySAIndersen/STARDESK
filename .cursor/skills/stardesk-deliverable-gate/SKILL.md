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

## Checklist

- [ ] `GET /health` shows intended `stardesk_env` (local = `development`, not `production`)
- [ ] Login `sf01@example.dk` / `Stardesk2026!`
- [ ] At least one ticket in API and on `/tickets` (demo labels)
- [ ] Attach gate output (+ screenshots from `--full`) to PR description

Full reference: `docs/deliverable-gate.md`
