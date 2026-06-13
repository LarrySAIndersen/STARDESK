#!/usr/bin/env python3
import os
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL", "")
parsed = urlparse(url.replace("postgresql+asyncpg://", "postgresql://"))
print(f"STARDESK_ENV={os.environ.get('STARDESK_ENV')!r}")
print(f"DATABASE_URL_set={bool(url)} len={len(url)}")
print(f"PROTOTYPE_SET={bool(os.environ.get('PROTOTYPE_BOOTSTRAP_PASSWORD'))}")
print(f"DB_HOST={parsed.hostname}")
print(f"DB_NAME={parsed.path.lstrip('/')}")
print("keys", sorted(k for k in os.environ if k.startswith(("DATABASE", "STARDESK", "PROTOTYPE"))))
