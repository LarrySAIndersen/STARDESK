# STARdesk on Kubernetes

Production-ready skeleton for running STARdesk (Next.js + FastAPI) on Kubernetes with **external Neon Postgres**. Vercel remains the primary deploy path; this is an additional option.

## Architecture

```
Internet → Ingress (stardesk.example.com) → stardesk-web:3000
                                              ↓ /api/proxy/* (BFF)
                                         stardesk-api:8000 → Neon (DATABASE_URL)
```

- **Browser** calls same-origin `/api/proxy/v1/...` (no public API URL in the client bundle).
- **Server** (SSR, Route Handlers) uses `NEXT_PUBLIC_API_URL` at **container runtime** to reach `http://stardesk-api:8000`.
- **API** is ClusterIP-only; CORS allowlist via `API_CORS_ORIGINS` / `FRONTEND_URL` (your ingress HTTPS URL).

## Prerequisites

- `kubectl` configured for your cluster
- Container runtime (`docker` or `podman`)
- [Neon](https://neon.tech) `DATABASE_URL` (`postgresql+asyncpg://...`)
- Ingress controller (e.g. [ingress-nginx](https://kubernetes.github.io/ingress-nginx/))
- Optional: [cert-manager](https://cert-manager.io/) for TLS

### Local cluster (minikube / kind)

```bash
# minikube
minikube start
minikube addons enable ingress

# kind — install ingress-nginx per kind docs, then:
kind create cluster --name stardesk
```

Load images into local cluster after build:

```bash
# minikube
eval $(minikube docker-env)
make k8s-build TAG=local

# kind
kind load docker-image stardesk-web:local stardesk-api:local --name stardesk
```

Update `deploy/kubernetes/kustomization.yaml` image tags to `local` if needed.

## Build images

From repository root:

```bash
docker build -t stardesk-web -f apps/web/Dockerfile .
docker build -t stardesk-api -f apps/api/Dockerfile .

# or
make k8s-build TAG=latest
# REGISTRY=ghcr.io/myorg/ make k8s-build TAG=v1.0.0
```

Verify Next.js standalone build locally:

```bash
cd apps/web && npm run build
```

## Configure secrets

```bash
cp deploy/kubernetes/secret.yaml.example deploy/kubernetes/secret.yaml
# Edit DATABASE_URL, JWT_SECRET, CRON_SECRET, WEBHOOK_SECRET — do not commit secret.yaml
```

Edit `deploy/kubernetes/configmap.yaml`:

- `API_CORS_ORIGINS` / `FRONTEND_URL` — your public URL(s)
- `NEXT_PUBLIC_API_URL` — keep `http://stardesk-api:8000` for in-cluster SSR/BFF

## Apply manifests

```bash
kubectl apply -f deploy/kubernetes/namespace.yaml
kubectl apply -f deploy/kubernetes/configmap.yaml
kubectl apply -f deploy/kubernetes/secret.yaml
kubectl apply -k deploy/kubernetes/

# Optional one-shot schema sync (API also migrates on startup)
kubectl apply -f deploy/kubernetes/schema-sync-job.yaml
kubectl wait --for=condition=complete job/schema-sync -n stardesk --timeout=120s
```

### Helm

```bash
helm upgrade --install stardesk deploy/helm/stardesk \
  --namespace stardesk --create-namespace \
  --set ingress.host=stardesk.example.com \
  --set secrets.databaseUrl="$DATABASE_URL" \
  --set secrets.jwtSecret="$JWT_SECRET"
```

Prefer External Secrets / Sealed Secrets in production instead of `--set` for credentials.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | Secret | Neon async URL (`postgresql+asyncpg://...`) |
| `JWT_SECRET` | Secret | API JWT signing |
| `CRON_SECRET` | Secret | Protects `/api/v1/cron/*` |
| `WEBHOOK_SECRET` | Secret | Email webhooks |
| `RESEND_API_KEY` | Secret | Optional mail |
| `NEXT_PUBLIC_API_URL` | ConfigMap | In-cluster API base for SSR/BFF (`http://stardesk-api:8000`) |
| `API_CORS_ORIGINS` | ConfigMap | CORS allowlist (alias of `FRONTEND_URL`) |
| `FRONTEND_URL` | ConfigMap | Same as CORS origins |
| `APP_ENV` | ConfigMap | `production` enforces secret validation |
| `PORT` | ConfigMap / API | API listen port (default `8000`) |

### Build time vs runtime (`NEXT_PUBLIC_*`)

| Consumer | Needs rebuild? |
|----------|----------------|
| Browser client bundle | Yes, if you change `NEXT_PUBLIC_*` used in client code |
| STARdesk BFF (`/api/proxy`) | **No** — uses runtime `process.env` on the Node server |
| Direct browser → API | Not used (proxy pattern) |

For K8s, set `NEXT_PUBLIC_API_URL` in the Deployment env (ConfigMap), not only at `docker build`.

## Health probes

| Service | Path | Port |
|---------|------|------|
| Web | `/api/health` | 3000 |
| API | `/health` | 8000 |

## Ingress & TLS

1. Set host in `deploy/kubernetes/ingress.yaml` (`stardesk.example.com`).
2. Point DNS to the ingress load balancer.
3. Uncomment `cert-manager.io/cluster-issuer` and create a `Certificate` or use your issuer.
4. TLS secret name: `stardesk-tls` (placeholder).

Direct API exposure is **optional** (commented path `/api` in ingress). Default: API only inside the cluster.

## Schema migrations

Bundled SQL migrations run automatically when the API starts (`ensure_ticket_schema_current`). Optional Job: `deploy/kubernetes/schema-sync-job.yaml`.

## Docker Compose (local)

```bash
export DATABASE_URL='postgresql+asyncpg://...'
docker compose up --build
# Web http://localhost:3000  API http://localhost:8000
```

## CI example

```bash
TAG="${GITHUB_SHA::7}"
make k8s-build TAG="$TAG" REGISTRY=ghcr.io/org/
docker push ghcr.io/org/stardesk-web:"$TAG"
docker push ghcr.io/org/stardesk-api:"$TAG"
kubectl set image deployment/stardesk-web web=ghcr.io/org/stardesk-web:"$TAG" -n stardesk
kubectl set image deployment/stardesk-api api=ghcr.io/org/stardesk-api:"$TAG" -n stardesk
```

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Web 502 on login/API | `NEXT_PUBLIC_API_URL` → `http://stardesk-api:8000`; API pods healthy |
| CORS errors | `API_CORS_ORIGINS` matches exact browser origin (scheme, host, no trailing slash) |
| API CrashLoop | `DATABASE_URL` secret; `APP_ENV=production` requires strong secrets |
| Probe failures | `/api/health` (web), `/health` (api); Basic Auth disabled unless both `BASIC_AUTH_*` set |

## Vercel coexistence

- `apps/web/vercel.json` and `apps/api/vercel.json` are unchanged.
- `output: 'standalone'` is ignored by Vercel’s build output layout.
- Use separate env in Vercel dashboard vs Kubernetes ConfigMaps/Secrets.
