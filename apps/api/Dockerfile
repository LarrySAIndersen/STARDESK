# Build from monorepo root:
#   docker build -t stardesk-api -f apps/api/Dockerfile .
FROM python:3.12-slim-bookworm

WORKDIR /app

RUN pip install --no-cache-dir --upgrade pip

COPY apps/api/pyproject.toml apps/api/README.md ./
COPY apps/api/src ./src

RUN pip install --no-cache-dir .

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" || exit 1

CMD ["sh", "-c", "uvicorn star_itsm_api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
