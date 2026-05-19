# STARDESK — Kubernetes image build helpers (Vercel deploy unchanged).
ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
TAG ?= latest
REGISTRY ?=

.PHONY: k8s-build k8s-build-web k8s-build-api web-build k8s-apply

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
