# Architecture — Project Overload v2

## Monorepo layout
- apps/api     : REST API (Report Contracts, Runs, Auth later)
- apps/worker  : Scheduler + job runner
- apps/web     : UI (later; MVP can be minimal)
- packages/shared    : types + schemas (zod) shared across apps
- packages/sql-guard : SQL policy enforcement + limiters
- packages/report-kit: HTML templates + PDF renderer wrapper
- infra/docker-compose.yml : postgres + redis for local dev

## Core domain objects
### ReportContract
- id, name, description
- timezone
- schedule_cron (nullable)
- delivery: email list (MVP)
- sql_template (locked SQL after approval)
- params (date window rules, filters)
- semantic_defs (metric definitions text)
- guardrails:
  - max_rows_evidence = 200
  - allowed_schemas/tables
  - deny_write = true

### ReportRun
- id, contract_id
- started_at, finished_at, status
- sql_executed (hash + stored for audit)
- evidence_table (stored snapshot, <=200 rows)
- summary_json (exec brief blocks)
- html_path, pdf_path
- diff_vs_last_run

## Runtime pipeline (worker)
1) Load contract
2) Generate/resolve parameters (date ranges)
3) Generate SQL (if unlocked -> use locked SQL; if draft -> API-only runs)
4) sql-guard validates and enforces limits
5) Execute query (read-only)
6) Reduce to <=200 rows evidence
7) Summarize evidence -> structured JSON brief
8) Render HTML -> PDF
9) Deliver (email MVP)
10) Persist run artifacts + diff baseline

## Guardrails
- Read-only DB user
- SQL policy: deny INSERT/UPDATE/DELETE/DDL; allow SELECT only
- Table allowlist
- Forced LIMIT if missing
- Row cap hard stop
- Full audit log of executed SQL + runtime

## Local dev
docker-compose: postgres + redis
apps talk to them via env vars
