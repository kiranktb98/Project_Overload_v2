import type { ExecutionContext, ReportContract } from "@project-overload/shared";
import type { DataPreparationResult, PreparedQuestionPayload, TokenUsageReport } from "./run-contract";

function emptyTokenUsage(): TokenUsageReport {
  return {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    by_agent: {},
    by_model: {}
  };
}

function buildSemanticQuestionList(contract: ReportContract): Array<{
  question_id: string;
  question_number: number;
  question: string;
  purpose: string;
  group_id?: string;
}> {
  const scoped = (contract.scope_clarifications ?? [])
    .filter((entry) => entry.answer && entry.answer.trim().length > 0)
    .map((entry) => ({
      question_id: `semantic_q_${entry.question_number}`,
      question_number: entry.question_number,
      question: entry.question,
      purpose: entry.answer ?? "Semantic-model question",
      group_id: `semantic_group_${entry.question_number}`
    }));

  if (scoped.length > 0) {
    return scoped;
  }

  return [{
    question_id: "semantic_q_1",
    question_number: 1,
    question: contract.name,
    purpose: `Answer ${contract.name} using the active Power BI semantic model`
  }];
}

function buildSemanticSummary(executionContext: ExecutionContext): string {
  const model = executionContext.powerbi_semantic_model;
  if (!model) {
    return "No Power BI semantic model metadata available.";
  }

  return [
    `Workspace: ${model.workspace_name} (${model.workspace_id})`,
    `Model: ${model.model_name} (${model.model_id})`,
    `Entities: ${model.entities.join(", ") || "none declared"}`,
    `Measures: ${model.measures.join(", ") || "none declared"}`,
    `Dimensions: ${model.dimensions.join(", ") || "none declared"}`
  ].join(" | ");
}

export async function preparePowerBiSemanticContractData(input: {
  contract: ReportContract;
  execution_context: ExecutionContext;
}): Promise<DataPreparationResult> {
  const model = input.execution_context.powerbi_semantic_model;
  if (!model) {
    throw new Error("Power BI semantic execution requested without semantic model metadata.");
  }

  const previewRows = (model.preview_rows ?? []).slice(0, 1000);
  const semanticSummary = buildSemanticSummary(input.execution_context);
  const questions = buildSemanticQuestionList(input.contract);

  const preparedPayloads: PreparedQuestionPayload[] = questions.map((question) => ({
    question_id: question.question_id,
    question_number: question.question_number,
    question: question.question,
    purpose: question.purpose,
    ...(question.group_id ? { group_id: question.group_id } : {}),
    source_query_count: 1,
    primary_sql: `POWERBI_SEMANTIC::${model.workspace_id}/${model.model_id}`,
    preparation_sqls: [
      `POWERBI_SEMANTIC_MODEL ${model.model_name}`,
      `ENTITIES ${model.entities.join(", ") || "none"}`,
      `MEASURES ${model.measures.join(", ") || "none"}`,
      `DIMENSIONS ${model.dimensions.join(", ") || "none"}`
    ],
    row_count_before_reduction: previewRows.length,
    prepared_row_count: previewRows.length,
    prepared_rows: previewRows,
    validation: undefined,
    preparation_notes: [
      "Prepared through the Power BI semantic planner/executor path.",
      "Preview rows come from semantic-model metadata instead of SQL execution."
    ],
    warnings: previewRows.length === 0
      ? ["This semantic model did not provide preview rows yet. Connect preview data before relying on analyst output."]
      : []
  }));

  return {
    planner_summary: `Power BI semantic planner prepared ${preparedPayloads.length} question set(s). ${semanticSummary}`,
    planner_context: semanticSummary,
    prepared_payloads: preparedPayloads,
    query_details: preparedPayloads.map((payload) => ({
      question_id: payload.question_id,
      question_number: payload.question_number,
      question: payload.question,
      sql: payload.primary_sql,
      row_count: payload.prepared_row_count,
      ...(payload.group_id ? { group_id: payload.group_id } : {})
    })),
    token_usage: emptyTokenUsage()
  };
}
