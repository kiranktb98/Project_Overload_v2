import { describe, expect, it } from "vitest";
import { LocalStubDataPlane } from "@project-overload/dataplane";
import {
  createStubAnalystClient,
  createStubPlannerClient,
  createStubQueryStrategistClient,
  createStubReportComposerClient
} from "@project-overload/llm-client";
import { buildApiApp } from "../src/app";
import { InMemoryMetadataStore } from "../src/store/create-store";

describe("api semantic and run flow", () => {
  it("stores semantic objects, stores contracts, and runs manual contract", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 480 }, (_, index) => ({
          customer_id: `c_${(index % 12) + 1}`,
          customer_email: `c_${(index % 12) + 1}@example.com`,
          amount: (index % 20) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          order_id: `o_${index + 1}`
        }))
    });

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const entityCreate = await app.inject({
      method: "POST",
      url: "/semantic/entities",
      payload: {
        id: "entity_customer",
        name: "Customer",
        description: "Customer table"
      }
    });

    expect(entityCreate.statusCode).toBe(201);

    const entityGet = await app.inject({
      method: "GET",
      url: "/semantic/entities/entity_customer"
    });

    expect(entityGet.statusCode).toBe(200);

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_weekly_ceo",
        name: "Weekly CEO report",
        audience: "CEO",
        timezone: "Asia/Kolkata",
        schedule_cron: "0 18 * * 5",
        sql_template: "SELECT * FROM analytics.sales",
        metric_ids: ["metric_revenue"],
        dimension_ids: ["region"],
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });

    expect(contractCreate.statusCode).toBe(201);

    const runContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/run"
    });

    expect(runContract.statusCode).toBe(202);
    const { run_id } = runContract.json();
    expect(typeof run_id).toBe("string");

    // Poll until the background pipeline writes the result.
    let pollBody: Record<string, unknown> | undefined;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const poll = await app.inject({ method: "GET", url: `/report-runs/${run_id}` });
      if (poll.json().status === "succeeded") { pollBody = poll.json(); break; }
    }
    expect(pollBody).toBeDefined();
    expect(typeof pollBody!.pdf_path).toBe("string");
    expect(Array.isArray(pollBody!.prepared_payloads)).toBe(true);
    expect((pollBody!.exec_brief as Record<string, unknown[]>).what_changed.length).toBeGreaterThan(0);
    expect((pollBody!.exec_brief as Record<string, unknown[]>).why.length).toBeGreaterThan(0);
    expect((pollBody!.exec_brief as Record<string, unknown[]>).so_what.length).toBeGreaterThan(0);
    expect((pollBody!.exec_brief as Record<string, unknown[]>).what_to_do.length).toBeGreaterThan(0);
    expect(Array.isArray((pollBody!.exec_brief as Record<string, unknown[]>).appendix_refs)).toBe(true);

    const runPdf = await app.inject({
      method: "GET",
      url: `/report-runs/${run_id}/pdf`
    });

    expect(runPdf.statusCode).toBe(200);
    expect(runPdf.headers["content-type"]).toContain("application/pdf");

    const contractRuns = await app.inject({
      method: "GET",
      url: "/report-contracts/contract_weekly_ceo/runs"
    });
    expect(contractRuns.statusCode).toBe(200);
    expect(contractRuns.json()).toHaveLength(1);

    const prepare = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/prepare"
    });
    expect(prepare.statusCode).toBe(200);
    expect(Array.isArray(prepare.json().prepared_payloads)).toBe(true);

    const qa = await app.inject({
      method: "POST",
      url: `/report-runs/${run_id}/qa`,
      payload: {
        question: "What changed?"
      }
    });
    expect(qa.statusCode).toBe(200);
    expect(typeof qa.json().answer).toBe("string");

    const saveRun = await app.inject({
      method: "POST",
      url: `/report-runs/${run_id}/save`
    });
    expect(saveRun.statusCode).toBe(200);
    expect(saveRun.json().saved).toBe(true);

    const lockContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/lock"
    });
    expect(lockContract.statusCode).toBe(200);

    const scheduleRun = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_weekly_ceo/schedule",
      payload: {
        frequency: "weekly",
        day_of_week: 1,
        hour_utc: 9,
        minute_utc: 0
      }
    });
    expect(scheduleRun.statusCode).toBe(200);
    expect(scheduleRun.json().schedule_cron).toBe("0 9 * * 1");

    await app.close();
  }, 90_000);

  it("serves report clarification and business case follow-up routes for a completed run", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 240 }, (_, index) => ({
          customer_id: `c_${(index % 8) + 1}`,
          amount: (index % 25) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          order_id: `o_${index + 1}`,
          event_time: new Date(Date.UTC(2025, index % 12, 1)).toISOString()
        }))
    });

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: {
        provider: "stub",
        async analyzeBatch(input) {
          return {
            request_id: input.request_id,
            batch_index: input.batch_index,
            total_batches: input.total_batches,
            highlights: ["Refund pressure is concentrated in a few regions."],
            risks: ["Margin leakage can persist without intervention."],
            recommendations: ["Tighten refund review rules"],
            confidence_score: 0.88,
            appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
            additional_query_requests: []
          };
        }
      },
      report_qa_client: {
        provider: "stub",
        async answerQuestion() {
          return {
            answer: "The generated report shows refund pressure concentrated in a few regions.",
            citations: ["q_1"],
            grounded: true,
            requires_new_analysis: false
          };
        }
      },
      business_case_client: {
        provider: "stub",
        async buildCase(input) {
          if (input.assumption_notes.length === 0) {
            return {
              status: "needs_clarification" as const,
              clarification_prompt: "Please provide at least one implementation cost or staffing assumption.",
              missing_inputs: ["Implementation cost", "Staffing assumption"],
              additional_query_requests: []
            };
          }

          return {
            status: "complete" as const,
            title: "Business case for tighter refund review rules",
            executive_summary: "The recommendation is viable if rollout cost and staffing assumptions hold.",
            recommendation: input.candidate.recommendation,
            baseline: ["Refund pressure is concentrated in a few regions."],
            assumptions: input.assumption_notes,
            implementation_plan: ["Configure review rules", "Pilot in the highest-risk region"],
            timeline_impact: [
              { period_label: "Time period 1 after implementation", impact: "Controls tighten and leakage slows." },
              { period_label: "Time period 2 after implementation", impact: "Savings accumulate as adoption stabilizes." }
            ],
            financial_view: ["Compare avoided refunds against implementation cost."],
            operational_view: ["Review queue volume may rise during the pilot."],
            risks: ["Strict rules may increase customer friction."],
            kpis_to_track: ["Refund rate", "Review backlog"],
            citations: [input.candidate.question_id],
            additional_query_requests: []
          };
        }
      },
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_followups",
        name: "Follow-up route test",
        audience: "CEO",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });
    expect(contractCreate.statusCode).toBe(201);

    const run_id = "run_followups_manual";
    await store.createReportRun({
      id: run_id,
      tenant_id: "default",
      contract_id: "contract_followups",
      status: "succeeded",
      trigger: "manual",
      attempt: 1,
      retry_of_run_id: null,
      started_at: "2026-03-12T00:00:00.000Z",
      finished_at: "2026-03-12T00:05:00.000Z",
      query_plan: {
        analysis_payloads: [
          {
            question_id: "q_1",
            question: "Where is refund pressure concentrated?",
            data_summary: "Regional refund pressure is concentrated in a few regions.",
            highlights: ["Refund pressure is concentrated in a few regions."],
            risks: ["Margin leakage can persist without intervention."],
            recommendations: ["Tighten refund review rules in the highest-risk regions."]
          }
        ],
        per_question_summaries: [
          {
            question_id: "q_1",
            question_text: "Where is refund pressure concentrated?",
            findings: ["Refund pressure is concentrated in a few regions."],
            drivers: ["Refund review rules are too loose in the highest-risk regions."],
            anomalies: [],
            coverage_status: "complete",
            coverage_notes: [],
            evidence_refs: ["q_1"],
            confidence_notes: []
          }
        ],
        prepared_payloads: [
          {
            question_id: "q_1",
            question_number: 1,
            question: "Where is refund pressure concentrated?",
            purpose: "Regional refund concentration",
            prepared_row_count: 3,
            warnings: [],
            validation: {
              expected_months: 4,
              observed_months: 4,
              missing_months: [],
              monthly_row_counts: [],
              metric_column: "refund_rate",
              monthly_metric_totals: []
            },
            sample_rows: [
              { region: "NA", refund_rate: 24.1 },
              { region: "EU", refund_rate: 18.7 }
            ]
          }
        ],
        metric_definitions: [
          {
            metric_key: "refund_rate",
            display_name: "Refund Rate",
            definition: "Refunded Rev / Total Rev"
          }
        ],
        business_context: "Refund leakage is materially impacting margin in some regions.",
        catalog_summary: "analytics.sales"
      },
      exec_brief: {
        what_changed: ["Refund pressure is concentrated in a few regions."],
        why: ["Regional leakage is materially higher in the highest-risk regions."],
        so_what: ["A tighter review policy could reduce refund leakage."],
        what_to_do: ["Tighten refund review rules in the highest-risk regions."],
        confidence: { score: 0.88, rationale: "Prepared evidence is consistent." },
        appendix_refs: ["q_1"],
        deltas_vs_last_run: [],
        generated_at: "2026-03-12T00:05:00.000Z"
      },
      report_html: "<html><body><h1>Follow-up route test</h1><p>Refund pressure is concentrated in a few regions.</p></body></html>"
    });

    const reportQa = await app.inject({
      method: "POST",
      url: `/report-runs/${run_id}/report-qa`,
      payload: {
        question: "What does the report say about refunds?"
      }
    });
    expect(reportQa.statusCode).toBe(200);
    expect(reportQa.json().grounded).toBe(true);
    expect(reportQa.json().answer).toContain("refund");

    const candidates = await app.inject({
      method: "GET",
      url: `/report-runs/${run_id}/business-case/candidates`
    });
    expect(candidates.statusCode).toBe(200);
    expect(Array.isArray(candidates.json().candidates)).toBe(true);
    expect(candidates.json().candidates.length).toBeGreaterThan(0);

    const clarification = await app.inject({
      method: "POST",
      url: `/report-runs/${run_id}/business-case`,
      payload: {
        candidate_id: candidates.json().candidates[0].candidate_id,
        question: "Build the business case."
      }
    });
    expect(clarification.statusCode).toBe(200);
    expect(clarification.json().status).toBe("needs_clarification");

    const completed = await app.inject({
      method: "POST",
      url: `/report-runs/${run_id}/business-case`,
      payload: {
        candidate_id: candidates.json().candidates[0].candidate_id,
        question: "Build the business case.",
        assumption_notes: ["Assume a $50k rollout cost and 2 analysts for the first quarter."]
      }
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().status).toBe("complete");
    expect(completed.json().timeline_impact).toHaveLength(2);

    await app.close();
  }, 90_000);

  it("creates scheduled report profiles, lists them, and uses the saved profile on scheduled reruns", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 320 }, (_, index) => ({
          order_id: `o_${index + 1}`,
          order_date: new Date(Date.UTC(2025, index % 6, 1)).toISOString(),
          amount: (index % 30) + 10,
          city: ["Bengaluru", "Pune", "Delhi", "Chennai"][index % 4],
          refund_status: index % 5 === 0 ? "refunded" : "completed"
        }))
    });

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_scheduled_profile",
        name: "Scheduled refund watch",
        audience: "Executive",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        metric_ids: ["metric_refunds"],
        dimension_ids: ["city"],
        insight_mode: "business",
        scope_clarifications: [
          {
            question_number: 1,
            question: "What is the monthly refund trend over the past 4 complete months?",
            answer: "Use the most recent 4 complete months with monthly granularity."
          },
          {
            question_number: 2,
            question: "Which cities have the highest refund rate over the past 4 complete months?",
            answer: "Use refund rate and rank the top cities."
          }
        ],
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });
    expect(contractCreate.statusCode).toBe(201);

    const manualRun = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_scheduled_profile/run"
    });
    expect(manualRun.statusCode).toBe(202);
    const manualRunId = manualRun.json().run_id as string;

    let manualRunBody: Record<string, unknown> | undefined;
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const poll = await app.inject({ method: "GET", url: `/report-runs/${manualRunId}` });
      if (poll.json().status === "succeeded") {
        manualRunBody = poll.json();
        break;
      }
    }
    expect(manualRunBody).toBeDefined();

    const draft = await app.inject({
      method: "GET",
      url: `/report-runs/${manualRunId}/schedule-draft`
    });
    expect(draft.statusCode).toBe(200);
    expect(Array.isArray(draft.json().questions)).toBe(true);
    expect(draft.json().questions.length).toBeGreaterThan(0);

    const createProfile = await app.inject({
      method: "POST",
      url: `/report-runs/${manualRunId}/schedule-profile`,
      payload: {
        frequency: "monthly",
        timezone: "UTC",
        day_of_month: 1,
        hour_local: 9,
        minute_local: 15,
        windowing_instructions: "Roll the window to the latest complete month on each run.",
        additional_instructions: "Keep the same governed questions and layout.",
        question_execution_plan: draft.json().questions.map((entry: Record<string, unknown>) => ({
          question_number: entry.question_number,
          next_run_behavior: `Re-run Q${entry.question_number} using the latest complete reporting window.`
        }))
      }
    });
    expect(createProfile.statusCode).toBe(200);
    expect(createProfile.json().profile.contract_id).toBe("contract_scheduled_profile");
    expect(createProfile.json().profile.hour_local).toBe(9);
    expect(createProfile.json().profile.minute_local).toBe(15);
    expect(createProfile.json().understanding.local_run_time).toBe("09:15");

    const listScheduled = await app.inject({
      method: "GET",
      url: "/scheduled-reports"
    });
    expect(listScheduled.statusCode).toBe(200);
    expect(listScheduled.json().items).toHaveLength(1);
    expect(listScheduled.json().items[0].contract_id).toBe("contract_scheduled_profile");
    expect(listScheduled.json().items[0].local_run_time).toBe("09:15");
    expect(typeof listScheduled.json().items[0].next_run_at).toBe("string");

    const detailScheduled = await app.inject({
      method: "GET",
      url: "/scheduled-reports/contract_scheduled_profile"
    });
    expect(detailScheduled.statusCode).toBe(200);
    expect(detailScheduled.json().profile.question_execution_plan).toHaveLength(draft.json().questions.length);
    expect(Array.isArray(detailScheduled.json().runs)).toBe(true);
    expect(detailScheduled.json().profile.hour_local).toBe(9);
    expect(detailScheduled.json().profile.minute_local).toBe(15);
    expect(typeof detailScheduled.json().next_run_at).toBe("string");

    const scheduledRun = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_scheduled_profile/run",
      payload: {
        trigger: "scheduled"
      }
    });
    expect(scheduledRun.statusCode).toBe(202);
    const scheduledRunId = scheduledRun.json().run_id as string;

    let scheduledRunBody: Record<string, unknown> | undefined;
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const poll = await app.inject({ method: "GET", url: `/report-runs/${scheduledRunId}` });
      if (poll.json().status === "succeeded") {
        scheduledRunBody = poll.json();
        break;
      }
    }
    expect(scheduledRunBody).toBeDefined();

    const storedScheduledRun = await store.getReportRunById(scheduledRunId);
    expect(storedScheduledRun?.query_plan.previous_run_id).toBe(manualRunId);
    expect(Array.isArray(storedScheduledRun?.query_plan.change_checker_notes)).toBe(true);

    await app.close();
  }, 90_000);

  it("does not expose business case candidates for report-review-only recommendations", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 120 }, (_, index) => ({
          amount: (index % 25) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          event_time: new Date(Date.UTC(2025, index % 4, 1)).toISOString()
        }))
    });

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: {
        provider: "stub",
        async analyzeBatch(input) {
          return {
            request_id: input.request_id,
            batch_index: input.batch_index,
            total_batches: input.total_batches,
            highlights: ["Refund revenue declined in the latest period."],
            risks: [],
            recommendations: ["Proceed to final report review and validate key findings against the appendix evidence refs."],
            confidence_score: 0.86,
            appendix_refs: [`${input.request_id}:batch-${input.batch_index + 1}`],
            additional_query_requests: []
          };
        }
      },
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_no_business_case_candidates",
        name: "No candidate filter test",
        audience: "CEO",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });
    expect(contractCreate.statusCode).toBe(201);

    const runContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_no_business_case_candidates/run"
    });
    expect(runContract.statusCode).toBe(202);
    const { run_id } = runContract.json();

    let runReady = false;
    for (let i = 0; i < 40; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const poll = await app.inject({ method: "GET", url: `/report-runs/${run_id}` });
      if (poll.json().status === "succeeded") {
        runReady = true;
        break;
      }
    }
    expect(runReady).toBe(true);

    const candidates = await app.inject({
      method: "GET",
      url: `/report-runs/${run_id}/business-case/candidates`
    });
    expect(candidates.statusCode).toBe(200);
    expect(candidates.json().candidates).toEqual([]);

    await app.close();
  }, 90_000);

  it("falls back to HTML download when PDF rendering is unavailable", async () => {
    const previousChromePath = process.env.CHROME_PATH;
    process.env.CHROME_PATH = "Z:\\missing\\chrome.exe";

    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 300 }, (_, index) => ({
          customer_id: `c_${(index % 10) + 1}`,
          customer_email: `c_${(index % 10) + 1}@example.com`,
          amount: (index % 35) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          order_id: `o_${index + 1}`
        }))
    });

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    try {
      const contractCreate = await app.inject({
        method: "POST",
        url: "/report-contracts",
        payload: {
          id: "contract_pdf_html_fallback",
          name: "PDF fallback report",
          audience: "CEO",
          timezone: "UTC",
          schedule_cron: null,
          sql_template: "SELECT * FROM analytics.sales",
          guardrails: {
            evidence_row_cap: 200,
            max_batches: 5,
            allowed_relations: ["analytics.sales"],
            allowed_schemas: ["analytics"],
            timeout_ms: 10000,
            deny_write: true
          }
        }
      });
      expect(contractCreate.statusCode).toBe(201);

      const runContract = await app.inject({
        method: "POST",
        url: "/report-contracts/contract_pdf_html_fallback/run"
      });
      expect(runContract.statusCode).toBe(202);
      const { run_id } = runContract.json();

      // Poll until the background pipeline writes the result.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const poll = await app.inject({ method: "GET", url: `/report-runs/${run_id}` });
        const s = poll.json().status;
        if (s === "succeeded" || s === "failed") break;
      }

      const runPdf = await app.inject({
        method: "GET",
        url: `/report-runs/${run_id}/pdf`
      });

      expect(runPdf.statusCode).toBe(200);
      expect(runPdf.headers["content-type"]).toContain("text/html");
      expect(runPdf.headers["x-report-fallback"]).toBe("html");
      expect(runPdf.body.toLowerCase()).toContain("<html");
    } finally {
      process.env.CHROME_PATH = previousChromePath;
      await app.close();
    }
  }, 90_000);

  it("accepts manual run request with empty JSON body", async () => {
    const store = new InMemoryMetadataStore();
    const dataPlane = new LocalStubDataPlane({
      row_provider: () =>
        Array.from({ length: 220 }, (_, index) => ({
          customer_id: `c_${(index % 8) + 1}`,
          customer_email: `c_${(index % 8) + 1}@example.com`,
          amount: (index % 15) + 1,
          region: ["NA", "EU", "APAC"][index % 3],
          order_id: `o_${index + 1}`
        }))
    });

    const app = await buildApiApp({
      store,
      data_plane: dataPlane,
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const contractCreate = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_empty_json_body",
        name: "Empty JSON body run test",
        audience: "Ops",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });

    expect(contractCreate.statusCode).toBe(201);

    const runContract = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_empty_json_body/run",
      headers: {
        "content-type": "application/json"
      }
    });

    expect(runContract.statusCode).toBe(202);
    const { run_id } = runContract.json();
    expect(run_id).toBeDefined();

    // Poll until the background pipeline writes the result.
    let pollBody: Record<string, unknown> | undefined;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const poll = await app.inject({ method: "GET", url: `/report-runs/${run_id}` });
      if (poll.json().status === "succeeded") { pollBody = poll.json(); break; }
    }
    expect(pollBody).toBeDefined();
    expect((pollBody!.exec_brief as Record<string, unknown[]>).what_changed.length).toBeGreaterThan(0);

    await app.close();
  });

  it("auto-locks contract on schedule and stores lifecycle versions", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const create = await app.inject({
      method: "POST",
      url: "/report-contracts",
      payload: {
        id: "contract_lifecycle",
        name: "Lifecycle Contract",
        audience: "Ops",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });
    expect(create.statusCode).toBe(201);

    // Scheduled/retry runs still require the contract to be locked first
    const scheduledRunBeforeLock = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/run",
      payload: {
        trigger: "scheduled"
      }
    });
    expect(scheduledRunBeforeLock.statusCode).toBe(409);

    // Schedule endpoint auto-locks the contract
    const scheduleResult = await app.inject({
      method: "POST",
      url: "/report-contracts/contract_lifecycle/schedule",
      payload: {
        frequency: "weekly",
        day_of_week: 1,
        kpi_watchlist: []
      }
    });
    expect(scheduleResult.statusCode).toBe(200);
    expect(scheduleResult.json().schedule_cron).toBeDefined();

    const versions = await app.inject({
      method: "GET",
      url: "/report-contracts/contract_lifecycle/versions"
    });
    expect(versions.statusCode).toBe(200);
    expect(Array.isArray(versions.json())).toBe(true);
    expect(versions.json().length).toBeGreaterThanOrEqual(2);

    await app.close();
  });

  it("isolates report contracts by tenant header", async () => {
    const app = await buildApiApp({
      store: new InMemoryMetadataStore(),
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    await app.inject({
      method: "POST",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_a" },
      payload: {
        id: "contract_tenant_a",
        name: "Tenant A Contract",
        audience: "Ops",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });

    await app.inject({
      method: "POST",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_b" },
      payload: {
        id: "contract_tenant_b",
        name: "Tenant B Contract",
        audience: "Ops",
        timezone: "UTC",
        schedule_cron: null,
        sql_template: "SELECT * FROM analytics.sales",
        guardrails: {
          evidence_row_cap: 200,
          max_batches: 5,
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 10000,
          deny_write: true
        }
      }
    });

    const listA = await app.inject({
      method: "GET",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_a" }
    });
    expect(listA.statusCode).toBe(200);
    expect(listA.json()).toHaveLength(1);
    expect(listA.json()[0].id).toBe("contract_tenant_a");

    const listB = await app.inject({
      method: "GET",
      url: "/report-contracts",
      headers: { "x-tenant-id": "tenant_b" }
    });
    expect(listB.statusCode).toBe(200);
    expect(listB.json()).toHaveLength(1);
    expect(listB.json()[0].id).toBe("contract_tenant_b");

    await app.close();
  });

  it("surfaces usage rollups and admin overview for Claritect operations", async () => {
    const now = new Date();
    const runStartedAt = new Date(now.getTime() - 3 * 60 * 1000).toISOString();
    const runFinishedAt = now.toISOString();
    const store = new InMemoryMetadataStore();
    const app = await buildApiApp({
      store,
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    await store.createReportContract({
      id: "contract_usage_admin",
      tenant_id: "default",
      name: "Usage and admin contract",
      audience: "Ops",
      timezone: "Asia/Kolkata",
      schedule_cron: "15 9 1 * *",
      sql_template: "SELECT * FROM analytics.sales",
      metric_ids: [],
      dimension_ids: [],
      insight_mode: "business",
      scope_clarifications: [],
      prepared_query_overrides: [],
      kpi_watchlist: [],
      guardrails: {
        evidence_row_cap: 200,
        max_batches: 5,
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 10_000,
        deny_write: true
      },
      lifecycle_status: "locked",
      contract_version: 1
    });

    await store.createReportRun({
      id: "run_usage_admin",
      tenant_id: "default",
      contract_id: "contract_usage_admin",
      status: "succeeded",
      trigger: "scheduled",
      attempt: 1,
      retry_of_run_id: null,
      started_at: runStartedAt,
      finished_at: runFinishedAt,
      query_plan: {
        manual_notes: [],
        planned_changes: [],
        previous_run_id: null,
        change_checker_notes: [],
        comparison_target_run_id: null,
        use_time_comparison: false,
        report_template_version: "v1"
      },
      exec_brief: {
        what_changed: [],
        why: [],
        so_what: [],
        what_to_do: [],
        appendix_refs: []
      },
      report_html: "<html><body>Claritect report</body></html>",
      delivery: {
        status: "not_configured",
        recipients: [],
        provider: "none",
        sent_at: null,
        error: null
      },
      token_usage: {
        input_tokens: 120,
        output_tokens: 80,
        total_tokens: 200,
        by_agent: {
          analyst: {
            input_tokens: 120,
            output_tokens: 80,
            total_tokens: 200
          }
        },
        by_model: {
          "openai/gpt-5.4": {
            input_tokens: 120,
            output_tokens: 80,
            total_tokens: 200
          }
        }
      }
    });

    await store.upsertScheduledReportProfile({
      id: "sched_usage_admin",
      tenant_id: "default",
      contract_id: "contract_usage_admin",
      source_run_id: "run_usage_admin",
      report_title: "Usage and admin report",
      frequency: "monthly",
      timezone: "Asia/Kolkata",
      day_of_week: null,
      day_of_month: 1,
      hour_utc: 9,
      minute_utc: 15,
      hour_local: 9,
      minute_local: 15,
      schedule_cron: "15 9 1 * *",
      status: "active",
      windowing_instructions: "Roll to the latest complete month.",
      additional_instructions: "Keep the same structure.",
      question_execution_plan: [
        {
          question_id: null,
          question_number: 1,
          question_text: "How is refund exposure trending?",
          current_scope_summary: "Trend refunds month over month.",
          next_run_behavior: "Re-run with the latest completed month window.",
          query_template_count: 0
        }
      ],
      query_template_snapshot: [],
      report_template_html: "<section>Claritect schedule template</section>",
      created_at: "2026-03-20T00:00:00.000Z",
      updated_at: "2026-03-25T03:48:00.000Z"
    });

    await store.setSystemState("runtime_connection_v1", {
      provider: "postgres",
      name: "Primary governed source",
      database: "claritect",
      allowed_relations: ["analytics.sales", "analytics.refunds"],
      connected_at: "2026-03-20T00:00:00.000Z"
    });

    await store.upsertSupportTicket({
      id: "ticket_admin_1",
      tenant_id: "default",
      title: "Dashboard clarification mismatch",
      status: "open",
      priority: "high",
      category: "reporting",
      requester_name: "Kiran",
      requester_email: "owner@example.com",
      assignee: "Claritect Ops",
      latest_message: "Need the executive summary numbers validated.",
      source: "manual",
      due_at: "2026-03-30T10:00:00.000Z"
    });

    await store.upsertInfraCostLedger({
      id: "cost_admin_1",
      tenant_id: "default",
      period_start: "2026-03-01T00:00:00.000Z",
      period_end: "2026-03-31T23:59:59.000Z",
      api_cost_usd: 28,
      worker_cost_usd: 24,
      storage_cost_usd: 1.4,
      platform_cost_usd: 6.6,
      total_cost_usd: 60,
      notes: "March shared and dedicated runtime cost"
    });

    const usageSummary = await app.inject({
      method: "GET",
      url: "/usage/summary",
      headers: {
        "x-ui-user": "test123"
      }
    });
    expect(usageSummary.statusCode).toBe(200);
    expect(usageSummary.json().summary.reports.total_runs).toBe(1);
    expect(usageSummary.json().summary.schedules.active).toBe(1);

    const usageAi = await app.inject({
      method: "GET",
      url: "/usage/ai",
      headers: {
        "x-ui-user": "test123"
      }
    });
    expect(usageAi.statusCode).toBe(200);
    expect(usageAi.json().usage.total_tokens).toBe(200);
    expect(usageAi.json().usage.by_agent.analyst.total_tokens).toBe(200);
    expect(usageAi.json().usage.by_model["openai/gpt-5.4"].total_tokens).toBe(200);
    expect(usageAi.json().balance.provider).toBe("openrouter");

    const forbiddenAdmin = await app.inject({
      method: "GET",
      url: "/admin/overview",
      headers: {
        "x-ui-user": "test123"
      }
    });
    expect(forbiddenAdmin.statusCode).toBe(401);

    await store.upsertPlatformUser({
      id: "user_claritect_admin",
      tenant_id: "default",
      username: "claritect_admin",
      password_salt: "salt",
      password_hash: "hash",
      role: "admin",
      display_name: "Claritect Admin",
      is_active: true
    });

    const adminOverview = await app.inject({
      method: "GET",
      url: "/admin/overview",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(adminOverview.statusCode).toBe(200);
    expect(adminOverview.json().overview.report_runs).toBe(1);
    expect(adminOverview.json().overview.active_schedules).toBe(1);
    expect(adminOverview.json().overview.open_tickets).toBe(1);
    expect(adminOverview.json().openrouter_balance.provider).toBe("openrouter");

    const adminAccounts = await app.inject({
      method: "GET",
      url: "/admin/accounts",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(adminAccounts.statusCode).toBe(200);
    expect(adminAccounts.json().items).toHaveLength(1);
    expect(adminAccounts.json().items[0].connection_count).toBe(1);
    expect(adminAccounts.json().items[0].report_runs).toBe(1);
    expect(adminAccounts.json().items[0].current_period_report_runs).toBe(1);
    expect(adminAccounts.json().items[0].active_schedules).toBe(1);
    expect(adminAccounts.json().items[0].open_tickets).toBe(1);
    expect(adminAccounts.json().items[0].current_infra_cost_usd).toBe(163.2);

    const adminSupport = await app.inject({
      method: "GET",
      url: "/admin/support",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(adminSupport.statusCode).toBe(200);
    expect(adminSupport.json().summary.total).toBe(1);
    expect(adminSupport.json().items[0].account_name).toBe("Default workspace");

    const adminFinance = await app.inject({
      method: "GET",
      url: "/admin/finance",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(adminFinance.statusCode).toBe(200);
    expect(adminFinance.json().summary.accounts).toBe(1);
    expect(adminFinance.json().summary.current_period_report_runs).toBe(1);
    expect(adminFinance.json().credit_accounts[0].current_period_report_runs).toBe(1);
    expect(adminFinance.json().infra_costs[0].total_cost_usd).toBe(163.2);
    expect(adminFinance.json().balance.provider).toBe("openrouter");
    expect(adminFinance.json().history.length).toBeGreaterThan(0);

    const adminSchedules = await app.inject({
      method: "GET",
      url: "/admin/schedules",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(adminSchedules.statusCode).toBe(200);
    expect(adminSchedules.json().items).toHaveLength(1);
    expect(adminSchedules.json().items[0].local_run_time).toBe("09:15");
    expect(typeof adminSchedules.json().items[0].next_run_at).toBe("string");

    await app.close();
  }, 30_000);

  it("auto-syncs support tickets, infra cost, and OpenRouter history for admin surfaces", async () => {
    const store = new InMemoryMetadataStore();
    const app = await buildApiApp({
      store,
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    const now = new Date();
    const startedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10, 6, 0, 0)).toISOString();
    const finishedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10, 6, 5, 0)).toISOString();

    await store.upsertPlatformUser({
      id: "user_claritect_admin",
      tenant_id: "default",
      username: "claritect_admin",
      password_salt: "salt",
      password_hash: "hash",
      role: "admin",
      display_name: "Claritect Admin",
      is_active: true
    });

    await store.createReportContract({
      id: "contract_auto_ops",
      tenant_id: "default",
      name: "Auto Ops Contract",
      audience: "Ops",
      timezone: "UTC",
      schedule_cron: "0 9 * * 1",
      sql_template: "SELECT * FROM analytics.sales",
      metric_ids: [],
      dimension_ids: [],
      insight_mode: "business",
      scope_clarifications: [],
      prepared_query_overrides: [],
      kpi_watchlist: [],
      guardrails: {
        evidence_row_cap: 200,
        max_batches: 5,
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 10_000,
        deny_write: true
      },
      lifecycle_status: "locked",
      contract_version: 1
    });

    await store.createReportRun({
      id: "run_auto_ops_failed",
      tenant_id: "default",
      contract_id: "contract_auto_ops",
      status: "failed",
      trigger: "scheduled",
      attempt: 1,
      retry_of_run_id: null,
      started_at: startedAt,
      finished_at: finishedAt,
      query_plan: { error: "Warehouse timeout while preparing governed payload." },
      exec_brief: { error: "Warehouse timeout while preparing governed payload." }
    });

    const overview = await app.inject({
      method: "GET",
      url: "/admin/overview",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().overview.open_tickets).toBeGreaterThanOrEqual(1);

    const accounts = await app.inject({
      method: "GET",
      url: "/admin/accounts",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(accounts.statusCode).toBe(200);
    expect(accounts.json().items[0].current_infra_cost_usd).toBeGreaterThan(0);
    expect(accounts.json().items[0].current_period_report_runs).toBeGreaterThan(0);
    expect(accounts.json().items[0].open_tickets).toBeGreaterThanOrEqual(1);

    const supportTickets = await store.listSupportTickets();
    expect(supportTickets.length).toBeGreaterThanOrEqual(1);
    expect(supportTickets[0].category).toBe("report_run_failure");
    expect(supportTickets[0].status).toBe("open");

    const infraCosts = await store.listInfraCostLedger();
    const balanceHistory = await store.listOpenRouterBalanceHistory();
    expect(infraCosts).toHaveLength(1);
    expect(balanceHistory.length).toBeGreaterThan(0);

    await app.close();
  });

  it("supports manual admin ticket creation and status updates", async () => {
    const store = new InMemoryMetadataStore();
    const app = await buildApiApp({
      store,
      data_plane: new LocalStubDataPlane({ row_provider: () => [] }),
      analyst_client: createStubAnalystClient(),
      query_strategist: createStubQueryStrategistClient(),
      report_composer: createStubReportComposerClient(),
      planner_client: createStubPlannerClient()
    });

    await store.upsertPlatformUser({
      id: "user_claritect_admin",
      tenant_id: "default",
      username: "claritect_admin",
      password_salt: "salt",
      password_hash: "hash",
      role: "admin",
      display_name: "Claritect Admin",
      is_active: true
    });

    const createTicket = await app.inject({
      method: "POST",
      url: "/admin/support",
      headers: {
        "x-ui-user": "claritect_admin"
      },
      payload: {
        tenant_id: "default",
        title: "Need help validating Growth plan credits",
        priority: "medium",
        category: "plan_support",
        requester_name: "Kiran",
        requester_email: "owner@example.com",
        assignee: "Claritect Operations",
        latest_message: "Please confirm how many report credits are included."
      }
    });
    expect(createTicket.statusCode).toBe(201);
    expect(createTicket.json().ticket.status).toBe("open");

    const updateTicket = await app.inject({
      method: "POST",
      url: `/admin/support/${createTicket.json().ticket.id}/status`,
      headers: {
        "x-ui-user": "claritect_admin"
      },
      payload: {
        status: "resolved",
        latest_message: "Plan credits confirmed with the customer."
      }
    });
    expect(updateTicket.statusCode).toBe(200);
    expect(updateTicket.json().ticket.status).toBe("resolved");

    const support = await app.inject({
      method: "GET",
      url: "/admin/support",
      headers: {
        "x-ui-user": "claritect_admin"
      }
    });
    expect(support.statusCode).toBe(200);
    expect(support.json().items[0].status).toBe("resolved");

    await app.close();
  });
});
