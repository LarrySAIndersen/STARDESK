# Staging batch policy (10 commits per deploy)

**Gælder fra:** 2026-06-03  
**Formål:** Færre Vercel Preview-deploys — saml arbejde i større pakker til `staging`. Production merges **kun Jan**.

---

## Regler

| Target | Policy |
|--------|--------|
| **`staging`** | Saml **op til 10 commits** på samme feature-gren før merge (ét deploy) |
| **`main` (prod)** | **Kun Jan** — PR `staging` → `main`, ingen agent auto-merge |

**Vercel Preview** deployer ved merge til `staging`. **Production** deployer kun ved merge til `main`.

---

## Flow

```text
feature-gren → (1..10 commits) → draft PR → ready når batch fuld → auto-merge → staging deploy
                                                                    ↓
                                              [Jan] PR staging → main → prod deploy
```

---

## For agenter

1. **Branch** fra seneste `staging`: `cursor/<beskrivelse>` eller `opgave-NN-slug`.
2. **Commit** løbende på samme gren — **ikke** merge efter hver commit.
3. **Draft PR** mod `staging` kan oprettes tidligt (CI kører ved push).
4. Når grenen har **10 commits** (eller færre med undtagelse nedenfor):
   - Kør deliverable gate
   - Markér PR **Ready for review** → auto-merge når CI er grøn
5. Efter merge: ny gren fra `staging` til næste batch.

### Relateret arbejde på samme gren

Små fixes (Sonar, kodepraksis, CI) kan dele gren `cursor/staging-batch` eller loop-gren `cursor/sonar-remediation-loop` — ét commit per tick/opgave, merge når 10 commits.

---

## Undtagelser (merge før 10 commits)

GitHub-label på PR:

| Label | Hvornår |
|-------|---------|
| `batch-ready` | Jan vil deploye batchen nu (fx sidste commit i dagen) |
| `hotfix` | Akut fix der ikke kan vente |

Jan kan også **manuel merge** i GitHub UI uanset commit-antal.

---

## CI-håndhævelse

Workflow `.github/workflows/auto-merge-staging.yml`:

- Auto-merge **springes over** hvis PR har færre end **10 commits** og ingen `batch-ready` / `hotfix` label.
- Draft PRs merges aldrig automatisk.

---

## Sonar remediation loop

- Én commit per tick på `cursor/sonar-remediation-loop`.
- PR forbliver **draft** indtil **10 commits**.
- **Ingen** auto-merge til `main` — Jan merger prod selv.

---

## Relateret

- [pr-only-period.md](./pr-only-period.md)
- [release-process.md](./release-process.md)
