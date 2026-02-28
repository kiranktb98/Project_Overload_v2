import { describe, expect, it } from "vitest";
import {
  AnalystInputSchema,
  BatchPlanSchema,
  BatchAnalysisSchema,
  ContractBatchAnalysisSchema,
  ContractEvidencePacketSchema,
  ContractExecBriefSchema,
  ContractQueryPlanSchema,
  ConversationOrchestratorDecisionSchema,
  EvidencePacketSchema,
  MergedQueryPlanOutputSchema,
  MetricSchema,
  PerQuestionAnalysisSummarySchema,
  PlannedQuerySchema,
  QueryStrategyOutputSchema,
  QualityEvalSchema,
  ReportContractDraftSchema,
  QueryPlanSchema,
  SemanticEntitySchema
} from "../src";

describe("shared schemas", () => {
  it("validates semantic entity and metric", () => {
    const entity = SemanticEntitySchema.parse({
      id: "entity_customer",
      name: "Customer",
      description: "Customer master"
    });

    const metric = MetricSchema.parse({
      id: "metric_revenue",
      name: "Revenue",
      definition: "sum(order_amount)",
      grain: "day"
    });

    expect(entity.name).toBe("Customer");
    expect(metric.name).toBe("Revenue");
  });

  it("rejects evidence packet above row cap", () => {
    const rows = Array.from({ length: 201 }, (_, index) => ({ index }));

    expect(() =>
      EvidencePacketSchema.parse({
        request_id: "req_1",
        batch_index: 0,
        total_batches: 1,
        rows,
        row_count: rows.length
      })
    ).toThrow();
  });

  it("rejects batch plan above max batches", () => {
    expect(() =>
      BatchPlanSchema.parse({
        method: "time_window",
        partition_field: "order_date",
        partitions: ["1", "2", "3", "4", "5", "6"],
        total_batches: 6
      })
    ).toThrow();
  });

  it("requires analyst total_batches and batch_index", () => {
    expect(() =>
      AnalystInputSchema.parse({
        request_id: "req_1",
        summary_word_budget: 150,
        evidence_packet: {
          request_id: "req_1",
          batch_index: 0,
          total_batches: 1,
          rows: [{ a: 1 }],
          row_count: 1
        }
      })
    ).toThrow();
  });

  it("supports query plan with hard budgets", () => {
    const plan = QueryPlanSchema.parse({
      id: "plan_1",
      contract_id: "contract_1",
      evidence_requests: [
        {
          id: "req_1",
          name: "Revenue trend",
          sql: "SELECT * FROM analytics.revenue"
        }
      ],
      budgets: {
        evidence_row_cap: 200,
        max_batches: 5
      }
    });

    expect(plan.budgets.evidence_row_cap).toBe(200);
    expect(plan.budgets.max_batches).toBe(5);
  });

  it("validates report contract draft schema", () => {
    const draft = ReportContractDraftSchema.parse({
      contract_name: "Weekly CEO Revenue",
      audience: "CEO",
      decision_use: "Board-ready weekly decisions",
      timezone: "Asia/Kolkata",
      schedule_nl: "Every Friday at 6 PM IST",
      schedule_cron: "0 18 * * 5",
      delivery: {
        emails: ["ceo@example.com"]
      },
      metrics: [{ metric_id: "metric_revenue" }],
      dimensions: ["region"],
      filters: [{ field: "status", operator: "=", value: "completed" }],
      thresholds: [{ metric_id: "metric_revenue", comparator: ">", value: 0 }],
      guardrails: {
        evidence_row_cap: 200,
        max_batches: 5,
        deny_write: true,
        timeout_ms: 15000,
        allowed_sources: ["analytics.sales_enriched"]
      }
    });

    expect(draft.contract_name).toBe("Weekly CEO Revenue");
    expect(draft.guardrails.evidence_row_cap).toBe(200);
  });

  it("enforces evidence packet and batch caps in core contracts", () => {
    expect(() =>
      ContractEvidencePacketSchema.parse({
        request_id: "req_1",
        batch_index: 0,
        total_batches: 6,
        columns: ["region"],
        rows: [{ region: "NA" }],
        notes: [],
        query_hash: "hash_1",
        data_freshness: "2026-01-01T00:00:00.000Z",
        warnings: []
      })
    ).toThrow();
  });

  it("validates core query plan and output contracts", () => {
    const queryPlan = ContractQueryPlanSchema.parse({
      plan_id: "plan_1",
      contract_id: "contract_1",
      approval_required: true,
      evidence_requests: [
        {
          request_id: "req_1",
          purpose: "Revenue by region",
          strategy: "db_join",
          sql: ["SELECT region, SUM(amount) AS amount FROM analytics.sales GROUP BY region"],
          reduction_plan: {
            aggregate_first: true,
            top_k: 10,
            grain: "week"
          },
          batch_plan: {
            method: "time_window",
            total_batches_estimate: 2,
            max_batches_cap: 5
          },
          expected_row_count_estimate: 120
        }
      ]
    });

    const batchAnalysis = ContractBatchAnalysisSchema.parse({
      request_id: "req_1",
      batch_index: 0,
      total_batches: 1,
      findings: ["Revenue increased in NA."],
      drivers: ["Enterprise deal volume rose."],
      anomalies: [],
      confidence: 0.82,
      evidence_refs: ["req_1:batch-1"]
    });

    const brief = ContractExecBriefSchema.parse({
      title: "Weekly CEO Revenue Brief",
      period: "2026-W01",
      headline: "Revenue rose 12% WoW",
      what_changed: ["NA and EU grew double digits."],
      why_changed: ["Higher conversion and larger deals."],
      so_what: ["Quarter target risk reduced."],
      actions: ["Shift budget toward high-performing channels."],
      confidence_notes: ["Consistent trend across key regions."],
      appendix: {
        evidence_packet_refs: batchAnalysis.evidence_refs,
        query_hashes: ["hash_1"]
      }
    });

    const quality = QualityEvalSchema.parse({
      pass: true,
      score_0_100: 91,
      issues: [],
      fix_instructions: []
    });

    expect(queryPlan.evidence_requests[0].strategy).toBe("db_join");
    expect(brief.headline).toContain("12%");
    expect(quality.score_0_100).toBe(91);
  });

  it("accepts PlannedQuery without group_id (Case 2)", () => {
    const query = PlannedQuerySchema.parse({
      question: "Revenue trend?",
      sql: "SELECT * FROM sales LIMIT 200",
      purpose: "Trend analysis"
    });
    expect(query.group_id).toBeUndefined();
  });

  it("accepts PlannedQuery with group_id (Case 1)", () => {
    const query = PlannedQuerySchema.parse({
      question: "Revenue by region?",
      sql: "SELECT * FROM sales LIMIT 200",
      purpose: "Regional breakdown",
      group_id: "overview"
    });
    expect(query.group_id).toBe("overview");
  });

  it("rejects PlannedQuery with empty group_id", () => {
    expect(() =>
      PlannedQuerySchema.parse({
        question: "Q?",
        sql: "SELECT 1",
        purpose: "P",
        group_id: ""
      })
    ).toThrow();
  });

  it("validates QueryStrategyOutput with mixed grouped and standalone queries", () => {
    const output = QueryStrategyOutputSchema.parse({
      queries: [
        { question: "Q1?", sql: "SELECT 1", purpose: "P1" },
        { question: "Q2?", sql: "SELECT 2", purpose: "P2", group_id: "g1" },
        { question: "Q3?", sql: "SELECT 3", purpose: "P3", group_id: "g1" }
      ]
    });
    expect(output.queries).toHaveLength(3);
    expect(output.queries[0].group_id).toBeUndefined();
    expect(output.queries[1].group_id).toBe("g1");
    expect(output.queries[2].group_id).toBe("g1");
  });

  it("supports analyst additional query requests", () => {
    const parsed = BatchAnalysisSchema.parse({
      request_id: "req_1",
      batch_index: 0,
      total_batches: 1,
      highlights: ["Partial coverage detected"],
      risks: ["Missing dimensions in evidence rows."],
      recommendations: ["Fetch additional grouped breakdown."],
      confidence_score: 0.64,
      appendix_refs: ["req_1:batch-1"],
      additional_query_requests: [
        {
          reason: "Need city-level split to validate regional concentration.",
          question: "What is refund concentration by city for the same window?",
          required_fields: ["city", "refund_amount", "total_orders"]
        }
      ]
    });

    expect(parsed.additional_query_requests).toHaveLength(1);
    expect(parsed.additional_query_requests[0]?.required_fields).toContain("city");
  });

  it("validates orchestrator mixed-intent decision contract", () => {
    const decision = ConversationOrchestratorDecisionSchema.parse({
      intent_parts: [
        { type: "new_question", text: "Compare refunds this month vs last month." },
        { type: "clarification_answer", text: "Use paid + delivered only.", question_ref: "Q1" },
        { type: "follow_up_request", text: "Also break down by city." }
      ],
      resolved_scope_answers: [
        { question_number: 1, answer: "Use paid + delivered statuses only." }
      ],
      new_scope_questions: [
        { question_text: "Refund trend by month", clarification: "Compare current month vs previous month." }
      ],
      follow_up_requests: [
        {
          question_text: "City breakdown for refund trend",
          requires_new_data: true,
          grounded_in_existing_payload: false,
          referenced_question_ids: ["q1"]
        }
      ],
      pending_inputs: [
        { input_key: "timeline_anchor", prompt: "Confirm timeline anchor month", question_number: 1 }
      ],
      next_owner: "query_planning_agent",
      tool_calls: [{ tool_name: "query_planning_agent", payload: { question_ids: ["q1"] } }],
      state_updates: {
        mark_scope_complete: false,
        append_new_questions: true,
        clear_pending_inputs: false,
        summary: "Need one timeline clarification before planning."
      }
    });

    expect(decision.intent_parts).toHaveLength(3);
    expect(decision.next_owner).toBe("query_planning_agent");
  });

  it("accepts nullable optional orchestrator string fields from provider output", () => {
    const decision = ConversationOrchestratorDecisionSchema.parse({
      intent_parts: [
        { type: "new_question", text: "Compare refunds this month vs last month.", question_ref: null }
      ],
      resolved_scope_answers: [],
      new_scope_questions: [],
      follow_up_requests: [],
      pending_inputs: [],
      next_owner: "wait_for_user",
      tool_calls: [],
      state_updates: {
        mark_scope_complete: false,
        append_new_questions: false,
        clear_pending_inputs: false,
        summary: null
      }
    });

    expect(decision.intent_parts[0]?.question_ref).toBeUndefined();
  });

  it("validates merged query planning output contract", () => {
    const output = MergedQueryPlanOutputSchema.parse({
      plan_id: "plan_merged_1",
      questions: [
        {
          question_id: "q1",
          question_number: 1,
          question_text: "Refund trend for 4 months",
          clarifications_used: ["Use order_date", "Include refunded status only"],
          group_id: "grp_q1",
          query_blocks: [
            {
              sql: "SELECT DATE_TRUNC('month', order_date) AS month, SUM(total_amount) AS refund_value FROM public.orders GROUP BY 1 LIMIT 50",
              purpose: "Monthly refund value trend",
              expected_rows: 4,
              joins_used: [],
              filters_used: ["status='refunded'"]
            }
          ],
          expected_output_columns: ["month", "refund_value"],
          success_criteria: ["4 monthly rows", "no missing months"]
        }
      ]
    });

    expect(output.questions[0].group_id).toBe("grp_q1");
    expect(output.questions[0].query_blocks).toHaveLength(1);
  });

  it("validates per-question analysis summary contract", () => {
    const summary = PerQuestionAnalysisSummarySchema.parse({
      question_id: "q1",
      question_text: "Refund trend for 4 months",
      findings: ["Refund value increased in January."],
      drivers: ["Holiday return volume spike."],
      anomalies: [],
      coverage_status: "complete",
      coverage_notes: ["Observed 4/4 expected months."],
      evidence_refs: ["q1:grp_q1:block_1"],
      confidence_notes: ["All required months present; no join-key loss."]
    });

    expect(summary.coverage_status).toBe("complete");
    expect(summary.evidence_refs).toContain("q1:grp_q1:block_1");
  });
});
