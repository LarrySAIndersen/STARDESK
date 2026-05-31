# PR-only politik (permanent)

**Status:** Permanent arbejdsgang for **STARDESK** — ikke en midlertidig periode.

Al ændring af kode og dokumentation skal gå via **Pull Request på GitHub** — aldrig direkte `git push` til `main` eller `staging`.

---

## Regler

| Gren | Tilladt | Forbudt |
|------|---------|---------|
| `cursor/*`, `opgave-*`, feature-grene | Push + **PR mod `staging`** | Push direkte til `staging` / `main` |
| **`staging`** | Modtage merge fra PR (auto når CI grøn) | Direkte push |
| **`main`** | Modtage merge fra PR **`staging` → `main`** (Jan) | Direkte push, feature-PR direkte til `main` |

**Vercel:** Preview ved merge til `staging`; Production ved merge til `main`.

---

## Flow

```text
feature-gren → PR → staging → [manuel] PR staging → main
```

Se [proces-visuelt.md](./proces-visuelt.md) og [release-process.md](./release-process.md).

---

## GitHub — permanent beskyttelse (én gangs opsætning)

### `main`

1. https://github.com/LarrySAIndersen/STARDESK/settings/branches  
2. Rule for `main`  
3. **Require a pull request before merging**  
4. **Do not allow bypassing** (anbefalet: inkl. administrators)  
5. Ingen direkte push til `main`  

### `staging`

Samme som `main`, med **auto-merge** tilladt når required checks passerer.

### Cursor Cloud Agent

Agent-konti må **ikke** have bypass, hvis politikken skal gælde alle.

---

## Agent (copy-paste)

```text
PR-ONLY (permanent): Push ALDRIG til main eller staging.
Alt via feature-gren + PR mod staging. Se docs/pr-only-policy.md.
```

---

## Undtagelser

Kun med **eksplicit godkendelse** (Jan): dokumenteret hotfix eller nød-rollback. Stadig PR når muligt.
