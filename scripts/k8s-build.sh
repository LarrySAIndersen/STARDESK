#!/usr/bin/env bash
# Build container images for Kubernetes (run from repo root).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="${TAG:-latest}"
REGISTRY="${REGISTRY:-}"

web_image="${REGISTRY}stardesk-web:${TAG}"
api_image="${REGISTRY}stardesk-api:${TAG}"

echo "Building ${web_image}"
docker build -t "${web_image}" -f "${ROOT}/apps/web/Dockerfile" "${ROOT}"

echo "Building ${api_image}"
docker build -t "${api_image}" -f "${ROOT}/apps/api/Dockerfile" "${ROOT}"

echo "Done: ${web_image} ${api_image}"
