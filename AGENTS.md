# Agent Rules (Codex)

## Golden rules
1) Never introduce write access to customer DB. Read-only SELECT only.
2) Every report run must enforce evidence row cap (<=200 rows).
3) Scheduling must be deterministic and testable (cron + timezone).
4) Outputs must be business-consumable: consistent sections + deltas vs last run.

## Coding conventions
- TypeScript everywhere
- Prefer zod schemas for boundary validation
- Keep modules small and testable
- Add tests for every guardrail change

## What to run locally
- `pnpm i`
- `pnpm dev` (starts api + worker + web)
- `pnpm test`
- `docker compose -f infra/docker-compose.yml up -d`

## Acceptance criteria for tasks
- Tests pass
- Lint passes
- No secrets committed
- Minimal diff (touch only relevant files)
