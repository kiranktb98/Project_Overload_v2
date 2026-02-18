# Agent Map

## Agent A - Contract Builder
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentA_buildContractDraft`
- Role: chat/user intent -> validated `ReportContractDraft`.

## Agent B - Semantic Mapper
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentB_mapMetadataToSemantic`
- Role: DB metadata -> semantic entities, fields, relationships.

## Agent C - Planner / Data Architect
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentC_buildQueryPlan`
- Role: contract + semantic context -> deterministic `ContractQueryPlan`.

## Tool T1 - SQL Policy Engine (deterministic)
- Path: `packages/sql-guard/src/index.ts`
- Role: SELECT-only enforcement, allowlist checks, limit enforcement.

## Tool T2 - Data Plane Executor
- Path: `packages/dataplane/src/index.ts`
- Role: governed query execution boundary (local/hybrid/saas mode).

## Agent D - Evidence Reducer & Batch Controller
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentD_reduceEvidence`
- Role: apply reduction and batching rules (`<=200` rows, `<=5` batches).

## Agent E - Batch Analyst
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentE_analyzeBatch`
- Role: per `EvidencePacket` -> `BatchAnalysis`.

## Agent F - Aggregator
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentF_aggregate`
- Role: all `BatchAnalysis` -> `ExecBrief`.

## Agent G - Renderer
- Path: `apps/api/src/agents/pipeline.ts`, `packages/report-render/src/index.ts`
- Function: `agentG_renderExecBrief`
- Role: `ExecBrief` -> HTML -> PDF bytes.

## Agent H - QA / Judge
- Path: `apps/api/src/agents/pipeline.ts`
- Function: `agentH_evaluateExecBrief`
- Role: score final output and return `QualityEval` with fix instructions.

## Agent I - Data Preparation
- Path: `apps/api/src/services/run-contract.ts`
- Function: `prepareReportContractData`, `runDataPreparationAgent`
- Role: executes one or more governed queries per question, reduces to evidence-safe payloads, enforces explicit comparison windows when detected.

## Agent J - Payload QA (Live Follow-ups)
- Path: `apps/api/src/services/run-contract.ts`
- Function: `answerRunPayloadQuestion`
- Role: answers post-run follow-up questions strictly from stored run payloads (no invented numbers).
