# Project_Overload_v2
AI Data Architect + Scheduled Narrative Reports (PDF) + KT

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

Seeded dataset includes:
- `analytics.customers` (~12,000 rows)
- `analytics.sales` (~75,000 rows)
- `analytics.sales_enriched` view for joined analysis

Example contract SQL for chat:
- `SELECT * FROM analytics.sales_enriched WHERE status = 'completed'`
