# Agent Map (Runtime)

This runtime uses a fixed multi-agent flow with strict guardrails:

1. Planner agent (`apps/api/src/services/planner.ts`)
- Input: approved `ReportContract`.
- Output: deterministic `QueryPlan` with budgets (`evidence_row_cap <= 200`, `max_batches <= 5`).

2. Data Plane agent boundary (`packages/dataplane/src/index.ts`)
- Input: evidence SQL from plan.
- Enforces: SELECT-only, allowlisted schemas/tables, forced limit, timeout, PII masking, audit event.
- Modes:
  - `local`: in-process stub executor.
  - `hybrid/saas`: remote Data Plane Agent over HTTP (same policy contract).

3. Evidence reducer (`packages/evidence/src/index.ts`)
- Input: governed query rows.
- Performs: aggregate-first, top-k, stratified sampling, deterministic batch planning.
- Output: `EvidencePacket <= 200` rows or `BatchPlan <= 5` batches.

4. Analyst agent (`packages/llm-client/src/index.ts`)
- Input: `AnalystInput` for each batch (`total_batches` and `batch_index` always required).
- Output: strict `BatchAnalysis` JSON.

5. Aggregator agent (`packages/evidence/src/index.ts`)
- Input: all batch analyses + previous run brief.
- Output: fixed `ExecBrief` sections:
  - `what_changed`
  - `why`
  - `so_what`
  - `what_to_do`
  - `confidence`
  - `appendix_refs`
  - `deltas_vs_last_run`

6. Renderer (`packages/report-render/src/index.ts`)
- Input: `ExecBrief`.
- Output: deterministic HTML and generated PDF.

## Chat Interface Flow

1. Web chat receives each user turn at `POST /api/chat`.
2. Deterministic contract handler updates state and run actions (`apps/web/src/chat.ts`).
3. Conversation adapter sends every turn to selected provider (`apps/web/src/conversation.ts`) with:
- user message
- deterministic response to preserve guardrails
- recent conversation history
- current draft state snapshot
4. Final assistant message is stored in chat state history and returned to UI.
5. UI can download generated report PDFs from `/api/runs/:runId/pdf`.

## Scheduling Flow

1. Worker periodically refreshes scheduled contracts from API.
2. Deterministic scheduler computes due runs by cron + timezone.
3. Due jobs are enqueued (memory/redis queue).
4. Worker dispatches each due job to `POST /report-contracts/:id/run`.
