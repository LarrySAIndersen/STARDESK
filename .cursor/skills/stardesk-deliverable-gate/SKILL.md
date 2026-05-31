---
name: stardesk-deliverable-gate
description: Mandatory hello-world verification before completing any STARDESK deliverable (PR, task, handoff). Login as demo Anna, list tickets on Alle sager, confirm non-production environment.
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
