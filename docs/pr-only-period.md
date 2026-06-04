# PR-only periode (obligatorisk)

**Gælder fra:** 2026-05-31  
**Formål:** Al ændring af kode og docs i `STARDESK` skal gå via **Pull Request på GitHub** — ikke direkte `git push` til `main` eller `staging`.

---

## Regler

| Gren | Tilladt | Forbudt |
|------|---------|---------|
| `cursor/*`, `opgave-*`, feature-grene | Push + **PR mod `staging`** | Push direkte til `staging` / `main` |
| **`staging`** | Modtage merge fra PR | Direkte push |
| **`main`** | Modtage merge fra PR **`staging` → `main`** (Jan) | Direkte push, feature-PR direkte til `main` |

**Vercel:** Deploy følger GitHub (Preview ved merge til `staging`, Production ved merge til `main`).

---

## Flow (alt arbejde)

```text
feature-gren → (op til 10 commits) → PR → staging (auto-merge når batch + CI grøn) → [Jan] PR → main
```

Se [proces-visuelt.md](./proces-visuelt.md) og **[staging-batch-policy.md](./staging-batch-policy.md)** (10 commits per staging-deploy).

---

## Staging batch (10 commits)

- Saml **op til 10 commits** på samme gren før merge til `staging` (færre Preview-deploys).
- Auto-merge kræver **≥ 10 commits** eller label **`batch-ready`** / **`hotfix`**.
- Hold PR som **draft** mens batchen bygges; markér **Ready for review** når batch er klar.
- **Production:** kun Jan via PR `staging` → `main` — agenter merger **aldrig** til `main`.

## Flow 2 — Production (hårdt krav)

**Production (main) opdateres KUN via åben PR staging → main — aldrig direkte push eller merge til main.** Når staging er foran main og bruger beder om deploy/prod, skal agent **altid** oprette denne PR (Jan merger).

---

## GitHub — slå direkte push fra (én gangs)

### `main`

1. https://github.com/LarrySAIndersen/STARDESK/settings/branches  
2. Rule for `main`  
3. **Require a pull request before merging**  
4. **Do not allow bypassing** (eller kun for dig bevidst)  
5. **Restrict who can push** — ingen direkte push (lad stå tom = kun via merge)  
6. **Include administrators** ✓  

### `staging`

Samme, men tillad **auto-merge** når checks er grønne.

### Cloud Agent / Cursor

- Agent-brugere må **ikke** have bypass hvis I vil håndhæve strengt.

---

## Agent (copy-paste)

```text
PR-ONLY PERIODE: Push ALDRIG til main eller staging.
Saml op til 10 commits per PR mod staging (draft indtil batch klar).
Prod kun Jan: staging → main. Se docs/staging-batch-policy.md.
```

---

## Undtagelser

Kun med **eksplicit skriftlig godkendelse** (Jan): hotfix, nød-rollback, initial repo-opsætning.

---

## Slut periode

Når I vil lempe: opdater denne fil med **Slutdato** og fjern streng agent-regel (behold anbefaling om PR mod staging).
