# Siloam Vendor SKU Price List & Mapping Portal

React (Vite) + Express BFF (`server.ts`, Bun) + Go API (`backend/`) on Postgres `siloam_sku`.

## Local

1. `cp .env.example .env` and fill `DATABASE_URL` (via `siloamhospitals-t tunnel` → `127.0.0.1:15432`) and `GEMINI_API_KEY`.
2. `bun install`
3. API: `cd backend && set -a && source ../.env && set +a && go run .`
4. Web: `bun server.ts` → http://localhost:3000

Checks: `bunx tsc --noEmit -p .`, `bun run build`, `cd backend && go test ./...` (needs a local Postgres with `pg_trgm`).

## Production

https://vendorsku.cgp-ai.com — Cloudflare → Caddy (`gateway-caddy`) → web `127.0.0.1:3060` → api `127.0.0.1:8096`.

- Server dir: `/opt/apps/vendorsku` (clone of this repo + server-only `.env`, mode 600).
- Push to `main` runs `.github/workflows/deploy.yml`: tests, then SSH → `deploy.sh` (pull, `docker compose up -d --build`, health check).
- Required repo secrets: `VPS_HOST`, `VPS_USER`, `VPS_KNOWN_HOSTS`, `VPS_SSH_KEY` (an existing authorized deploy key).
- Manual deploy: `ssh siloamhospitals-t 'bash /opt/apps/vendorsku/deploy.sh'`.
