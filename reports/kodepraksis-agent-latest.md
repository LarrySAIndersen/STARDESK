# Kodepraksis tick — punkt #39

**Expand Ruff: C90, D, S, SIM, PTH, RET, ARG** (LINT)

| Felt | Værdi |
|------|-------|
| Relevans | critical quick win |
| Inkrementelt | ja |
| Queue status | in_progress |
| Forsøg | 1 |
| Sidste fallback | — |

## Primær scope
pyproject.toml select += C90,D,S,SIM,PTH,RET,ARG; fix violations in batches

## Verifikation
- `cd apps/api && uv run ruff check .`
- `cd apps/api && uv run pytest -q`

## Fallback-ladder (kør i rækkefølge ved fejl)
### 1. PARTIAL — >100 D/S violations
Enable SIM+RET+ARG only (no D/S first)

### 2. DEFER — C901 blocks merge
per-file-ignores for tickets.py until #21 split

### 3. SKIP — Team rejects docstring police (D)
Keep E,F,I,UP only

## Debate note
Week 1 item 1 — start here.

## Agent — denne tick
1. Implementér **primær scope**.
2. Kør verifikation. Ved fejl: prøv **partial** → **defer** → **skip** (dokumentér i queue).
3. `bash scripts/run-deliverable-gate.sh` (+ `--full` ved web).
4. PR mod `staging` (ikke Sonar-loop — normal PR-only).
5. Afslut tick: `npm run kodepraksis:result -- --n 39 --status done|partial|deferred|wontfix [--fallback partial] [--notes "..."] [--pr URL]`
