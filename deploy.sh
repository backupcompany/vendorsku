#!/usr/bin/env bash
# Runs on the VPS: pull main, rebuild, and fail loudly unless both services answer.
set -euo pipefail
cd /opt/apps/vendorsku
git fetch --quiet origin main
git reset --hard --quiet origin/main
set -a; source .env; set +a
docker compose up -d --build --remove-orphans
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${GO_PORT}/api/health" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    docker image prune -f >/dev/null
    echo "vendorsku deployed $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done
docker compose logs --tail 80
exit 1
