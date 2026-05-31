# STARDESK — Kubernetes image build helpers (Vercel deploy unchanged).
ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
TAG ?= latest
REGISTRY ?=

.PHONY: k8s-build k8s-build-web k8s-build-api web-build k8s-apply \
	dev-deps db-bootstrap db-migrate dev-api dev-web verify \
	dev-setup dev-up deliverable-gate deliverable-gate-full

dev-deps:
	cd apps/web && npm ci
	cd apps/api && uv sync --group dev

db-bootstrap:
	bash scripts/bootstrap-dev-database.sh

db-bootstrap-local:
	bash scripts/bootstrap-dev-database.sh --local-postgres

db-migrate:
	bash scripts/migrate-db.sh

dev-api:
	cd apps/api && uv run uvicorn star_itsm_api.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd apps/web && npm run dev -- --hostname 0.0.0.0 --port 3000

dev-setup:
	bash scripts/setup-dev-environment.sh --local-postgres

dev-up:
	bash scripts/dev-up.sh

deliverable-gate:
	bash scripts/run-deliverable-gate.sh

deliverable-gate-full:
	bash scripts/run-deliverable-gate.sh --full

verify:
	cd apps/api && uv run pytest -q
	cd apps/web && npm run lint
	cd apps/web && npm run build
	deliverable-gate

k8s-build:
	TAG=$(TAG) REGISTRY=$(REGISTRY) bash scripts/k8s-build.sh

k8s-build-web:
	docker build -t $(REGISTRY)stardesk-web:$(TAG) -f apps/web/Dockerfile .

k8s-build-api:
	docker build -t $(REGISTRY)stardesk-api:$(TAG) -f apps/api/Dockerfile .

web-build:
	cd apps/web && npm run build

k8s-apply:
	kubectl apply -k deploy/kubernetes/
	@echo "Apply secrets separately: cp deploy/kubernetes/secret.yaml.example deploy/kubernetes/secret.yaml"
