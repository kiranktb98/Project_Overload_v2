import { z } from "zod";

const OptionalTrimmedStringSchema = z.preprocess(
  (value) => {
    if (value === null) {
      return undefined;
    }
    return typeof value === "string" ? value.trim() : value;
  },
  z.string().optional()
);
const NullableTrimmedStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().nullable()
);
const NonEmptyStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1)
);

export const ConversationIntentPartSchema = z.object({
  part_id: NonEmptyStringSchema.optional(),
  type: z.enum([
    "new_question",
    "clarification_answer",
    "follow_up_request",
    "duplicate",
    "chitchat",
    "other"
  ]),
  text: NonEmptyStringSchema,
  question_ref: OptionalTrimmedStringSchema
});

export const ResolvedScopeAnswerSchema = z.object({
  question_number: z.number().int().min(1),
  answer: NonEmptyStringSchema,
  source_part_id: NonEmptyStringSchema.optional()
});

export const NewScopeQuestionSchema = z.object({
  question_text: NonEmptyStringSchema,
  clarification: NonEmptyStringSchema,
  reason: NonEmptyStringSchema.optional()
});

export const FollowUpRequestSchema = z.object({
  question_text: NonEmptyStringSchema,
  requires_new_data: z.boolean().default(false),
  grounded_in_existing_payload: z.boolean().default(false),
  referenced_question_ids: z.array(NonEmptyStringSchema).default([])
});

export const PendingInputSchema = z.object({
  input_key: NonEmptyStringSchema,
  prompt: NonEmptyStringSchema,
  reason: NonEmptyStringSchema.optional(),
  question_number: z.number().int().min(1).optional()
});

export const OrchestratorToolCallSchema = z.object({
  tool_name: NonEmptyStringSchema,
  reason: NonEmptyStringSchema.optional(),
  payload: z.record(z.string(), z.unknown()).default({})
});

export const ConversationOrchestratorStateUpdatesSchema = z.object({
  mark_scope_complete: z.boolean().default(false),
  append_new_questions: z.boolean().default(false),
  clear_pending_inputs: z.boolean().default(false),
  summary: NullableTrimmedStringSchema.default(null),
  question_registry_updates: z
    .array(
      z.object({
        question_number: z.number().int().min(1),
        question_id: NonEmptyStringSchema.optional(),
        status: z.enum(["open", "scoped", "prepared", "analyzed", "complete"]).default("open")
      })
    )
    .default([])
});

export const ConversationOrchestratorDecisionSchema = z.object({
  intent_parts: z.array(ConversationIntentPartSchema).default([]),
  resolved_scope_answers: z.array(ResolvedScopeAnswerSchema).default([]),
  new_scope_questions: z.array(NewScopeQuestionSchema).default([]),
  follow_up_requests: z.array(FollowUpRequestSchema).default([]),
  pending_inputs: z.array(PendingInputSchema).default([]),
  next_owner: z.enum([
    "conversation_orchestrator",
    "query_planning_agent",
    "data_prep_orchestrator",
    "batch_analyst",
    "super_summary",
    "report_composer",
    "qa",
    "wait_for_user"
  ]),
  tool_calls: z.array(OrchestratorToolCallSchema).default([]),
  state_updates: ConversationOrchestratorStateUpdatesSchema.default({})
});

export const MergedQueryPlanBlockSchema = z.object({
  sql: NonEmptyStringSchema,
  purpose: NonEmptyStringSchema,
  expected_rows: z.number().int().min(0),
  joins_used: z.array(NonEmptyStringSchema).default([]),
  filters_used: z.array(NonEmptyStringSchema).default([])
});

export const MergedPerQuestionPlanSchema = z.object({
  question_id: NonEmptyStringSchema,
  question_number: z.number().int().min(1),
  question_text: NonEmptyStringSchema,
  clarifications_used: z.array(NonEmptyStringSchema).default([]),
  group_id: NonEmptyStringSchema,
  query_blocks: z.array(MergedQueryPlanBlockSchema).min(1),
  expected_output_columns: z.array(NonEmptyStringSchema).default([]),
  success_criteria: z.array(NonEmptyStringSchema).default([])
});

export const MergedQueryPlanOutputSchema = z.object({
  plan_id: NonEmptyStringSchema.optional(),
  questions: z.array(MergedPerQuestionPlanSchema).min(1)
});

export const PerQuestionAnalysisSummarySchema = z.object({
  question_id: NonEmptyStringSchema,
  question_text: NonEmptyStringSchema,
  findings: z.array(NonEmptyStringSchema).default([]),
  drivers: z.array(NonEmptyStringSchema).default([]),
  anomalies: z.array(NonEmptyStringSchema).default([]),
  coverage_status: z.enum(["complete", "partial", "insufficient"]),
  coverage_notes: z.array(NonEmptyStringSchema).default([]),
  evidence_refs: z.array(NonEmptyStringSchema).default([]),
  confidence_notes: z.array(NonEmptyStringSchema).default([])
});

export type ConversationIntentPart = z.infer<typeof ConversationIntentPartSchema>;
export type ResolvedScopeAnswer = z.infer<typeof ResolvedScopeAnswerSchema>;
export type NewScopeQuestion = z.infer<typeof NewScopeQuestionSchema>;
export type FollowUpRequest = z.infer<typeof FollowUpRequestSchema>;
export type PendingInput = z.infer<typeof PendingInputSchema>;
export type OrchestratorToolCall = z.infer<typeof OrchestratorToolCallSchema>;
export type ConversationOrchestratorStateUpdates = z.infer<
  typeof ConversationOrchestratorStateUpdatesSchema
>;
export type ConversationOrchestratorDecision = z.infer<
  typeof ConversationOrchestratorDecisionSchema
>;
export type MergedQueryPlanBlock = z.infer<typeof MergedQueryPlanBlockSchema>;
export type MergedPerQuestionPlan = z.infer<typeof MergedPerQuestionPlanSchema>;
export type MergedQueryPlanOutput = z.infer<typeof MergedQueryPlanOutputSchema>;
export type PerQuestionAnalysisSummary = z.infer<typeof PerQuestionAnalysisSummarySchema>;
