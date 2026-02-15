# Project_Overload_v2
AI Data Architect + Scheduled Narrative Reports (PDF) + KT

## Runtime map
- Agent map: `docs/AGENT_MAP.md`
- API health: `GET /health` on `http://localhost:4000`
- Web chat: `http://localhost:3000`
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
