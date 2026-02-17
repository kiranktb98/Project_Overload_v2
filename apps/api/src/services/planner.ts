import { QueryPlanSchema, type QueryPlan, type ReportContract } from "@project-overload/shared";

export function buildDeterministicQueryPlan(contract: ReportContract): QueryPlan {
  return QueryPlanSchema.parse({
    id: `plan_${contract.id}`,
    contract_id: contract.id,
    evidence_requests: [
      {
        id: `evidence_${contract.id}_1`,
        name: `${contract.name} primary evidence`,
        sql: contract.sql_template,
        metric_ids: contract.metric_ids,
        dimension_ids: contract.dimension_ids
      }
    ],
    budgets: {
      evidence_row_cap: contract.guardrails.evidence_row_cap,
      max_batches: contract.guardrails.max_batches
    }
  });
}