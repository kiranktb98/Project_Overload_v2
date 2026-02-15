# Project_Overload_v2
AI Data Architect + Scheduled Narrative Reports (PDF) + KT

## Runtime map
- Agent map: `docs/AGENT_MAP.md`
- API health: `GET /health` on `http://localhost:4000`
- Web chat: `http://localhost:3000`
- DB connector UI: `http://localhost:3000/connect`
- Worker loop: `apps/worker` (scheduler + queue + run dispatcher)

## Quick start
1. Install deps:
   - `pnpm install`
2. Start infra:
   - `docker compose -f infra/docker-compose.yml up -d`
3. Apply migrations (includes analytics seed data):
   - `pnpm db:migrate`
4. Start all services:
   - `pnpm dev`
5. Run test suite:
   - `pnpm test`

## Local Analytics Test Dataset (Docker)
1. Start local infra:
   - `docker compose -f infra/docker-compose.yml up -d`
2. Apply migrations (includes analytics seed data):
   - `pnpm db:migrate`
3. In `.env`, use local Postgres as DataPlane source:
   - `DATAPLANE_MODE=local`
   - `DATAPLANE_LOCAL_SOURCE=postgres`
   - `DATAPLANE_LOCAL_PG_URL=postgresql://po:po@localhost:54321/po_v2`
4. Start runtime:
   - `pnpm dev`

## Chat provider modes
If you want every chat turn to require a live AI provider response, set:
- `WEB_CHAT_REQUIRE_PROVIDER=true`
- `WEB_CHAT_FALLBACK_TO_DETERMINISTIC=false`
- `LLM_PROVIDER=openrouter` (or `openai`)
- corresponding API key env vars in local `.env`

The web header shows provider mode at runtime (`stub/openai/openrouter` + `deterministic/provider`).

## UI database connection (Postgres/Supabase)
Use the Database Connector module (separate page from chat):
1. Open `http://localhost:3000/connect`
2. Paste Postgres connection string
3. Click `Test Connection`
4. Select allowlisted tables
5. Click `Connect + Save Allowlist`
6. Run a safe query (`SELECT` only) from the same page
7. Open chat (`/`) and run:
   - `use connected tables`
   - `query: SELECT * FROM your_schema.your_table LIMIT 20`
   - then draft/save/run report contracts

Connection settings are runtime memory for now (not persisted across service restarts).

### TLS / Corporate SSL Inspection (Pilot-Friendly Fix)
**Problem:** some pilot users see errors like `self-signed certificate in certificate chain` when testing a Postgres/Supabase connection. This typically happens when a corporate network is doing TLS inspection and re-signing certificates with an internal corporate root CA. Your browser trusts it (because the root CA is installed in the OS), but Node may not (because Node historically relied on its bundled CA list).

**What we changed:** the API now builds Postgres TLS trust using the **system CA store** (plus Node bundled CAs) while keeping TLS verification on. This means corporate roots installed on the OS are trusted without disabling TLS verification.

**If it still fails:** open **Advanced TLS** on `http://localhost:3000/connect` and paste your org/DB **root CA** in PEM format into **Custom CA (PEM)**, then retry `Test Connection`.

**Dev-only workaround:** you can append `sslmode=no-verify` to a connection string, but do not use this in production.

### Supabase Notes (DNS / Pooler)
Some Supabase direct DB hosts can fail to resolve on certain networks (for example when only an AAAA/IPv6 record is available). For best compatibility, use Supabase **Connection Pooling -> Transaction mode** host (`*.pooler.supabase.com`) on **port 6543**.

### Production Guidance (Avoiding TLS Issues for All Users)
For production deployments, do not rely on users switching networks.

Recommended options (in order):
1. **Hybrid mode:** run a Data Plane Agent inside the customer's network so it uses their local trust store and network path to the DB.
2. **Install the corporate/root CA in the runtime environment** where the API/agent runs:
   - VM/bare metal: install CA into the OS trust store.
   - Docker/Kubernetes: bake/mount the CA into the image and set `NODE_EXTRA_CA_CERTS=/path/to/ca.pem` (or install into the OS trust store inside the container) and restart.
3. **Per-connection CA support:** allow a customer admin to provide a CA chain for that specific connection and store it securely server-side (do not make it a global CA for all tenants).

## Worker scheduling
- Worker refreshes contracts from API and registers only contracts with `schedule_cron`.
- Due jobs are computed deterministically from cron + timezone.
- Jobs are queued and dispatched to `POST /report-contracts/:id/run`.
- Config:
  - `WORKER_API_BASE_URL` (default falls back to `WEB_API_BASE_URL` / `NEXT_PUBLIC_API_URL` / `http://127.0.0.1:4000`)
  - `WORKER_QUEUE_DRIVER=memory|redis`
  - `REDIS_URL` and optional `WORKER_QUEUE_KEY` when using redis

## Security reminders
- Keep secrets only in local `.env`.
- Never commit `.env` or API keys.
- Customer DB access remains read-only SELECT through DataPlane policy.

Seeded dataset includes:
- `analytics.customers` (~12,000 rows)
- `analytics.sales` (~75,000 rows)
- `analytics.sales_enriched` view for joined analysis

Example contract SQL for chat:
- `SELECT * FROM analytics.sales_enriched WHERE status = 'completed'`
