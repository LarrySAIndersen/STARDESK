# Huskeliste — Dev, gate, Sonar, bash (Windows + Cloud Agent)

Opdateret: 2026-06-04. Spejlet til Work Board canvas (`stardesk-huskeliste-v1`).

## Dev-servere (Windows)

```powershell
pwsh -File scripts/dev-up.ps1
pwsh -File scripts/dev-up.ps1 -Stop
```

- API: http://localhost:8000  
- Web: http://localhost:3000  
- Hvis porte er optaget: `-ForcePorts` eller stop gamle processer.

## Deliverable gate

```bash
# Git Bash (Windows) — fra repo root
bash scripts/run-deliverable-gate.sh
bash scripts/run-deliverable-gate.sh --full    # + Playwright UI
```

```powershell
# PowerShell (anbefalet på Windows, inkl. staging)
pwsh -File scripts/run-deliverable-gate.ps1
pwsh -File scripts/run-deliverable-gate.ps1 -Staging -SkipTests
pwsh -File scripts/run-deliverable-gate.ps1 -Full -Staging
```

Login: `sf01@example.dk` / demo-password fra `apps/api/.env` (`PROTOTYPE_BOOTSTRAP_PASSWORD`).

## Staging Preview (Vercel protection)

- API: https://api-git-staging-kjaerby-1628s-projects.vercel.app  
- Web: https://web-git-staging-kjaerby-1628s-projects.vercel.app  
- Uden token giver `bash --staging` ofte **401** på `/health`.
- Sæt `VERCEL_PROTECTION_BYPASS` eller `vercel link` i `apps/web` — se `docs/staging-vercel-preview-env.md`.
- Bash API-gate sender `x-vercel-protection-bypass` når env er sat (PR #137).

## Sonar — dev-scripts (supply-chain)

| Kommando | Flag |
|----------|------|
| `npm ci` / `npm install` | `--ignore-scripts` |
| `uv sync` | `--group dev --no-build` |
| Kør pytest/python | **venv-binaries** via `scripts/lib/api-venv.sh` |

**Undgå** `uv run --no-build` — bryder editable `star-itsm-api` og deliverable gate.

Merged PRs: #123, #129, #132, #134 (S2083 `safe_repo_paths.py`).

## Bash på Windows

- Brug **Git Bash**: `"C:\Program Files\Git\bin\bash.exe"`
- Repo-sti med mellemrum: `'/c/Users/kjaer/STARDESK Cursor/STARDESK'`
- `bash` via WSL kan fejle på stier med mellemrum.

## PR / staging batch

- Feature-PR → base **`staging`**, draft indtil 10 commits eller label `batch-ready` / `hotfix`.
- Prod kun Jan: PR `staging` → `main`.

## Åbne opfølgninger

- [ ] Merge PR #137 (staging gate Vercel bypass) til `staging`
- [ ] Efter merge til `main`: Sonar-dashboard opdateres på prod-gren
