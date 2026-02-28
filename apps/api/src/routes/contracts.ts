import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ContractLifecycleStatusSchema,
  ExecBriefSchema,
  KpiWatchlistItemSchema,
  ReportContractSchema,
  ReportContractDeliverySchema,
  ReportGuardrailsSchema,
  ReportRunSchema,
  type SqlDialect
} from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import type {
  AnalystClient,
  PlannerClient,
  QueryStrategistClient,
  ReportComposerClient,
  SuperSummaryClient
} from "@project-overload/llm-client";
import { renderExecBriefHtml, renderPdfFromHtml } from "@project-overload/report-render";
import type { MetadataStore } from "../store";
import type { RuntimeConnectionManager } from "../dataplane/connection-manager";
import { resolveRequestContext } from "../security/request-context";
import {
  answerRunPayloadQuestionWithOrchestrator,
  prepareReportContractData,
  runReportContractPipeline
} from "../services/run-contract";
import { deliverReportRun } from "../services/delivery";

export function registerContractRoutes(
  app: FastifyInstance,
  store: MetadataStore,
  dataPlane: DataPlane,
  analystClient: AnalystClient,
  queryStrategist: QueryStrategistClient,
  reportComposer: ReportComposerClient,
  superSummaryClient: SuperSummaryClient,
  plannerClient: PlannerClient,
  connectionManager: RuntimeConnectionManager
): void {
  app.post("/worker-events", async (request, reply) => {
    const context = resolveRequestContext(request);
    const parsed = z
      .object({
        event_type: z.string().trim().min(1),
        payload: z.record(z.string(), z.unknown()).default({})
      })
      .safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid worker event payload",
        issues: parsed.error.issues
      });
    }

    await store.appendAuditLog(parsed.data.event_type, parsed.data.payload, context);
    return reply.code(200).send({ ok: true });
  });

  app.post("/report-contracts", async (request, reply) => {
    const context = resolveRequestContext(request);
    const payload = toReportContract(request.body, context.tenant_id);
    const existing = await store.getReportContract(payload.id, context);

    const now = new Date().toISOString();
    const created = await store.createReportContract(
      {
        ...payload,
        tenant_id: context.tenant_id,
        contract_version: (existing?.contract_version ?? 0) + 1,
        lifecycle_status: payload.lifecycle_status ?? existing?.lifecycle_status ?? "draft",
        approved_at: payload.approved_at ?? existing?.approved_at ?? null,
        approved_by: payload.approved_by ?? existing?.approved_by ?? null,
        locked_at: payload.locked_at ?? existing?.locked_at ?? null,
        locked_by: payload.locked_by ?? existing?.locked_by ?? null
      },
      context
    );

    await store.createReportContractVersion(
      created.id,
      created,
      existing ? "contract updated" : "contract created",
      context
    );
    await store.appendAuditLog(
      "report_contract_saved",
      {
        contract_id: created.id,
        contract_version: created.contract_version,
        lifecycle_status: created.lifecycle_status,
        actor_id: context.actor_id,
        saved_at: now
      },
      context
    );
    reply.code(201).send(created);
  });

  app.get("/report-contracts", async (request) => {
    return store.listReportContracts(resolveRequestContext(request));
  });

  app.get("/report-contracts/:id", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    return contract;
  });

  app.get("/report-contracts/:id/versions", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);
    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    return reply.code(200).send(await store.listReportContractVersions(id, context));
  });

  app.post("/report-contracts/:id/approve", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const approvedAt = new Date().toISOString();
    const updated = await store.createReportContract(
      {
        ...contract,
        tenant_id: context.tenant_id,
        lifecycle_status: "approved",
        contract_version: (contract.contract_version ?? 0) + 1,
        approved_at: approvedAt,
        approved_by: context.actor_id
      },
      context
    );
    await store.createReportContractVersion(updated.id, updated, "contract approved", context);
    await store.appendAuditLog(
      "report_contract_approved",
      {
        contract_id: updated.id,
        contract_version: updated.contract_version,
        actor_id: context.actor_id,
        approved_at: approvedAt
      },
      context
    );

    return reply.code(200).send(updated);
  });

  app.post("/report-contracts/:id/lock", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const approvedAt = contract.approved_at ?? new Date().toISOString();
    const approvedBy = contract.approved_by ?? context.actor_id;
    const lockedAt = new Date().toISOString();

    const updated = await store.createReportContract(
      {
        ...contract,
        tenant_id: context.tenant_id,
        lifecycle_status: "locked",
        contract_version: (contract.contract_version ?? 0) + 1,
        approved_at: approvedAt,
        approved_by: approvedBy,
        locked_at: lockedAt,
        locked_by: context.actor_id
      },
      context
    );
    await store.createReportContractVersion(updated.id, updated, "contract locked", context);
    await store.appendAuditLog(
      "report_contract_locked",
      {
        contract_id: updated.id,
        contract_version: updated.contract_version,
        actor_id: context.actor_id,
        locked_at: lockedAt
      },
      context
    );

    return reply.code(200).send(updated);
  });

  app.post("/report-contracts/:id/run", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const runInput = z
      .object({
        trigger: z.enum(["manual", "scheduled", "retry"]).default("manual"),
        attempt: z.number().int().min(1).default(1),
        retry_of_run_id: z.string().trim().min(1).optional()
      })
      .safeParse(request.body ?? {});
    const trigger = runInput.success ? runInput.data.trigger : "manual";
    const attempt = runInput.success ? runInput.data.attempt : 1;
    const retryOfRunId = runInput.success ? runInput.data.retry_of_run_id ?? null : null;

    if (trigger !== "manual" && contract.lifecycle_status !== "locked") {
      return reply.code(409).send({
        message: "Scheduled/retry runs require the report contract to be locked."
      });
    }

    // Pre-generate a stable run ID and create a "pending" record immediately.
    // The pipeline will upsert it to "succeeded" (or the catch block to "failed").
    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    await store.createReportRun(
      ReportRunSchema.parse({
        id: runId,
        tenant_id: context.tenant_id,
        contract_id: id,
        status: "pending",
        trigger,
        attempt,
        retry_of_run_id: retryOfRunId,
        started_at: startedAt,
        finished_at: null,
        query_plan: {},
        exec_brief: {}
      }),
      context
    );

    // Fire pipeline in the background — no await so the HTTP response returns instantly.
    void (async () => {
      try {
        const catalogSummary = buildCatalogSummary(connectionManager, contract.guardrails.allowed_relations);
        const sqlDialect = resolveSqlDialect(connectionManager);

        const result = await runReportContractPipeline({
          run_id: runId,
          contract,
          tenant_id: context.tenant_id,
          trigger,
          attempt,
          retry_of_run_id: retryOfRunId,
          store,
          data_plane: dataPlane,
          analyst_client: analystClient,
          query_strategist: queryStrategist,
          report_composer: reportComposer,
          super_summary_client: superSummaryClient,
          planner_client: plannerClient,
          catalog_summary: catalogSummary,
          sql_dialect: sqlDialect
        });

        // Pipeline already upserted the run with status:"succeeded" internally.
        // Upsert once more to attach delivery info.
        const delivery = await deliverReportRun({
          contract,
          run: result.run,
          exec_brief: result.exec_brief
        });
        await store.createReportRun({ ...result.run, delivery }, context);
        await store.appendAuditLog(
          "report_delivery_attempt",
          {
            contract_id: id,
            run_id: runId,
            status: delivery.status,
            provider: delivery.provider,
            recipients: delivery.recipients,
            error: delivery.error
          },
          context
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pipeline failed";
        // Upsert the pending record as "failed" so the poll endpoint surfaces the error.
        await store.createReportRun(
          ReportRunSchema.parse({
            id: runId,
            tenant_id: context.tenant_id,
            contract_id: id,
            status: "failed",
            trigger,
            attempt,
            retry_of_run_id: retryOfRunId,
            started_at: startedAt,
            finished_at: new Date().toISOString(),
            query_plan: { error: message },
            exec_brief: { error: message }
          }),
          context
        ).catch(() => {
          // ignore store errors in error handler
        });
      }
    })();

    return reply.code(202).send({ run_id: runId, status: "pending" });
  });

  app.post("/report-contracts/:id/prepare", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    try {
      const catalogSummary = buildCatalogSummary(connectionManager, contract.guardrails.allowed_relations);
      const sqlDialect = resolveSqlDialect(connectionManager);
      const result = await prepareReportContractData({
        contract,
        tenant_id: context.tenant_id,
        store,
        data_plane: dataPlane,
        query_strategist: queryStrategist,
        planner_client: plannerClient,
        catalog_summary: catalogSummary,
        sql_dialect: sqlDialect
      });

      return reply.code(200).send({
        contract_id: id,
        planner_summary: result.planner_summary,
        prepared_payloads: result.prepared_payloads.map((payload) => ({
          question_id: payload.question_id,
          question_number: payload.question_number,
          question: payload.question,
          purpose: payload.purpose,
          group_id: payload.group_id,
          source_query_count: payload.source_query_count,
          preparation_sqls: payload.preparation_sqls,
          row_count_before_reduction: payload.row_count_before_reduction,
          prepared_row_count: payload.prepared_row_count,
          validation: payload.validation,
          preparation_notes: payload.preparation_notes,
          warnings: payload.warnings,
          sample_rows: (payload.prepared_rows ?? []).slice(0, 5)
        })),
        token_usage: result.token_usage
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Data preparation failed";
      return reply.code(500).send({ message: `Preparation failed: ${message}` });
    }
  });

  app.get("/report-contracts/:id/runs", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const runs = await store.listReportRuns(id, context);
    return reply.code(200).send(runs);
  });

  app.get("/report-runs/:runId", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { runId } = request.params as { runId: string };
    const run = await store.getReportRunById(runId, context);

    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    if (run.status === "succeeded") {
      const qp = run.query_plan as Record<string, unknown>;
      return reply.code(200).send({
        status: "succeeded",
        run_id: run.id,
        exec_brief: run.exec_brief,
        exec_brief_html: run.report_html ?? "",
        prepared_payloads: Array.isArray(qp.prepared_payloads) ? qp.prepared_payloads : [],
        kpi_results: Array.isArray(qp.kpi_results) ? qp.kpi_results : [],
        pdf_path: `/report-runs/${run.id}/pdf`
      });
    }

    if (run.status === "failed") {
      const qp = run.query_plan as Record<string, unknown>;
      return reply.code(200).send({
        status: "failed",
        run_id: run.id,
        error: typeof qp.error === "string" ? qp.error : "Report run failed"
      });
    }

    // pending or running
    return reply.code(200).send({ status: run.status, run_id: run.id });
  });

  app.post("/report-runs/:runId/qa", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { runId } = request.params as { runId: string };
    const parsed = z.object({ question: z.string().trim().min(1) }).safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ message: "Question is required." });
    }

    const run = await store.getReportRunById(runId, context);
    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    const answer = await answerRunPayloadQuestionWithOrchestrator({
      run,
      question: parsed.data.question,
      query_strategist: queryStrategist,
      catalog_summary: buildCatalogSummary(connectionManager)
    });
    return reply.code(200).send(answer);
  });

  app.post("/report-runs/:runId/save", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { runId } = request.params as { runId: string };
    const run = await store.getReportRunById(runId, context);
    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    const loggedAt = new Date().toISOString();
    await store.appendAuditLog(
      "report_saved",
      {
        run_id: run.id,
        contract_id: run.contract_id,
        logged_at: loggedAt,
        actor_id: context.actor_id
      },
      context
    );

    return reply.code(200).send({
      run_id: run.id,
      contract_id: run.contract_id,
      saved: true,
      logged_at: loggedAt
    });
  });

  app.post("/report-contracts/:id/schedule", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);
    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const parsed = z.object({
      frequency: z.enum(["weekly", "monthly", "quarterly"]),
      timezone: z.string().min(1).optional(),
      day_of_week: z.number().int().min(0).max(6).optional(),
      day_of_month: z.number().int().min(1).max(28).optional(),
      hour_utc: z.number().int().min(0).max(23).default(9),
      minute_utc: z.number().int().min(0).max(59).default(0),
      kpi_watchlist: z.array(KpiWatchlistItemSchema).default([])
    }).safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid schedule payload",
        issues: parsed.error.issues
      });
    }

    const schedule = buildScheduleCron(parsed.data);
    if (!schedule.ok) {
      return reply.code(400).send({ message: schedule.message });
    }

    const now = new Date().toISOString();
    const timezone = parsed.data.timezone ?? contract.timezone;
    const updated = toReportContract(
      {
        ...contract,
        timezone,
        schedule_cron: schedule.cron,
        kpi_watchlist: parsed.data.kpi_watchlist,
        lifecycle_status: "locked",
        locked_at: contract.locked_at ?? now,
        locked_by: contract.locked_by ?? context.actor_id ?? "system"
      },
      context.tenant_id
    );
    updated.contract_version = (contract.contract_version ?? 0) + 1;
    await store.createReportContract(updated, context);
    await store.createReportContractVersion(updated.id, updated, "schedule updated", context);
    await store.appendAuditLog(
      "report_schedule_updated",
      {
        contract_id: contract.id,
        frequency: parsed.data.frequency,
        cron: schedule.cron,
        timezone,
        kpi_watchlist_count: parsed.data.kpi_watchlist.length,
        actor_id: context.actor_id
      },
      context
    );

    return reply.code(200).send({
      contract_id: contract.id,
      frequency: parsed.data.frequency,
      timezone,
      schedule_cron: schedule.cron
    });
  });

  app.get("/report-runs/:runId/pdf", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { runId } = request.params as { runId: string };
    const run = await store.getReportRunById(runId, context);

    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    try {
      // Prefer the stored Report Composer HTML (rich styled); fall back to ExecBrief template
      const html =
        typeof run.report_html === "string" && run.report_html.length > 0
          ? run.report_html
          : renderExecBriefHtml(ExecBriefSchema.parse(run.exec_brief));

      const htmlWithMetrics = injectMetricDefinitionsIntoHtml(
        html,
        extractMetricDefinitionsFromQueryPlan(run.query_plan)
      );
      const customerFacingHtml = stripConfidenceFromCustomerHtml(htmlWithMetrics);
      try {
        const pdf = await renderPdfWithRetry(customerFacingHtml, 2);

        return reply
          .code(200)
          .header("content-type", "application/pdf")
          .header("content-disposition", `attachment; filename="report-${run.id}.pdf"`)
          .send(pdf.bytes);
      } catch (pdfError) {
        const message = pdfError instanceof Error ? pdfError.message : "PDF generation failed";
        await store.appendAuditLog(
          "report_pdf_fallback_html",
          {
            run_id: run.id,
            contract_id: run.contract_id,
            reason: message
          },
          context
        );

        return reply
          .code(200)
          .header("content-type", "text/html; charset=utf-8")
          .header("content-disposition", `attachment; filename="report-${run.id}.html"`)
          .header("x-report-fallback", "html")
          .send(customerFacingHtml);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed";
      return reply.code(500).send({ message });
    }
  });
}

function extractMetricDefinitionsFromQueryPlan(
  queryPlan: Record<string, unknown>
): Array<{
  metric_key: string;
  display_name: string;
  definition: string;
  source_type: "column" | "derived";
  source_columns: string[];
}> {
  const parsed = z
    .array(
      z.object({
        metric_key: z.string().min(1),
        display_name: z.string().min(1),
        definition: z.string().min(1),
        source_type: z.enum(["column", "derived"]).default("derived"),
        source_columns: z.array(z.string().min(1)).default([])
      })
    )
    .safeParse(queryPlan["metric_definitions"]);

  return parsed.success ? parsed.data : [];
}

function injectMetricDefinitionsIntoHtml(
  html: string,
  definitions: Array<{
    metric_key: string;
    display_name: string;
    definition: string;
    source_type: "column" | "derived";
    source_columns: string[];
  }>
): string {
  if (definitions.length === 0) {
    return html;
  }

  if (/metric definitions/i.test(html)) {
    return html;
  }

  const items = definitions
    .slice(0, 8)
    .map((definition) => {
      const sources =
        definition.source_columns.length > 0
          ? ` (source: ${definition.source_columns.join(", ")})`
          : definition.source_type === "column"
            ? " (source: column metric)"
            : " (source: derived metric)";
      return `<li><strong>${escapeHtml(definition.display_name)}</strong>: ${escapeHtml(definition.definition)}${escapeHtml(sources)}</li>`;
    })
    .join("");

  const section = [
    '<section style="border:1px solid #dbeafe;border-radius:10px;padding:14px;margin:16px 0;background:#f8fbff;">',
    '<h2 style="margin:0 0 8px 0;font-size:16px;color:#1e3a8a;">Metric Definitions</h2>',
    `<ul style="margin:0;padding-left:18px;line-height:1.45;">${items}</ul>`,
    "</section>"
  ].join("");

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${section}</body>`);
  }

  return `${html}\n${section}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripConfidenceFromCustomerHtml(html: string): string {
  return html
    .replace(/<[^>]*class=["'][^"']*\bconfidence\b[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "")
    .replace(/<p[^>]*>\s*Confidence\s*:[^<]*<\/p>/gi, "")
    .replace(/<li[^>]*>\s*Confidence\s*:[^<]*<\/li>/gi, "")
    .replace(/<strong[^>]*>\s*Confidence\s*:?\s*<\/strong>/gi, "")
    .replace(/\bConfidence\s*:\s*\d+(?:\.\d+)?%?/gi, "");
}

async function renderPdfWithRetry(html: string, retries: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await renderPdfFromHtml(html);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
  }
  throw (lastError instanceof Error ? lastError : new Error("PDF generation failed"));
}

function toReportContract(body: unknown, tenantId: string) {
  const payload = body as Record<string, unknown>;

  const lifecycle = ContractLifecycleStatusSchema.optional().parse(payload.lifecycle_status);
  const delivery = ReportContractDeliverySchema.parse(payload.delivery ?? { emails: [] });

  return ReportContractSchema.parse({
    id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : randomUUID(),
    tenant_id: tenantId,
    name: payload.name,
    audience: payload.audience ?? "Executive",
    timezone: payload.timezone ?? "UTC",
    schedule_cron: payload.schedule_cron ?? null,
    sql_template: payload.sql_template ?? "SELECT * FROM analytics.sales",
    metric_ids: Array.isArray(payload.metric_ids) ? payload.metric_ids : [],
    metric_definitions: Array.isArray(payload.metric_definitions) ? payload.metric_definitions : [],
    dimension_ids: Array.isArray(payload.dimension_ids) ? payload.dimension_ids : [],
    insight_mode: typeof payload.insight_mode === "string" ? payload.insight_mode : "business",
    delivery,
    lifecycle_status: lifecycle ?? "draft",
    contract_version:
      typeof payload.contract_version === "number" && Number.isInteger(payload.contract_version)
        ? payload.contract_version
        : 1,
    approved_by: typeof payload.approved_by === "string" ? payload.approved_by : null,
    approved_at: typeof payload.approved_at === "string" ? payload.approved_at : null,
    locked_by: typeof payload.locked_by === "string" ? payload.locked_by : null,
    locked_at: typeof payload.locked_at === "string" ? payload.locked_at : null,
    scope_clarifications: Array.isArray(payload.scope_clarifications) ? payload.scope_clarifications : [],
    guardrails: ReportGuardrailsSchema.parse(payload.guardrails ?? {})
  });
}

function buildCatalogSummary(connectionManager: RuntimeConnectionManager, allowedRelations?: string[]): string {
  const catalog = connectionManager.getCatalog();
  if (!catalog || !catalog.tables || catalog.tables.length === 0) {
    return "No catalog available.";
  }

  // Filter catalog to only include allowlisted tables when provided.
  // This prevents the LLM from referencing tables that will fail preflight checks.
  let candidateTables = catalog.tables.slice(0, 40);
  if (allowedRelations && allowedRelations.length > 0) {
    const allowed = new Set(allowedRelations.map((r) => r.toLowerCase()));
    const filtered = candidateTables.filter((t) => allowed.has(t.qualified_name.toLowerCase()));
    if (filtered.length > 0) {
      candidateTables = filtered;
    }
  }

  const sections: string[] = [];
  sections.push(`BUSINESS_ID: ${catalog.business_id}`);
  if (typeof catalog.business_context === "string" && catalog.business_context.trim().length > 0) {
    sections.push(`BUSINESS_CONTEXT: ${catalog.business_context.trim()}`);
  }
  sections.push("");

  for (const table of candidateTables.slice(0, 20)) {
    const tableId = table.table_id ? ` [${table.table_id}]` : "";
    const rowInfo = table.row_count_estimate > 0 ? ` (~${table.row_count_estimate} rows)` : "";
    const header = `TABLE: ${table.qualified_name}${tableId}${rowInfo}`;
    const colLines = table.columns.slice(0, 30).map((c: { column_name: string; data_type: string }) =>
      `  - ${c.column_name} : ${c.data_type}`
    );
    const summaryLines = table.summary ? [`  summary: ${table.summary}`] : [];
    const lowCardLines = table.low_cardinality_columns.length > 0
      ? [
          "  low_cardinality:",
          ...table.low_cardinality_columns.slice(0, 8).map((entry) => {
            const values = entry.distinct_values.slice(0, 10).join(", ");
            return `    - ${entry.column_name}: [${values}]`;
          })
        ]
      : [];
    const extra = table.columns.length > 30 ? [`  ... +${table.columns.length - 30} more columns`] : [];
    sections.push([header, ...summaryLines, ...lowCardLines, ...colLines, ...extra].join("\n"));
  }

  return sections.join("\n\n");
}

function resolveSqlDialect(connectionManager: RuntimeConnectionManager): SqlDialect {
  const provider = connectionManager.getContext().provider;
  if (provider === "mysql") {
    return "mysql";
  }
  if (provider === "snowflake") {
    return "snowflake";
  }
  if (provider === "bigquery") {
    return "bigquery";
  }
  return "postgres";
}

function buildScheduleCron(input: {
  frequency: "weekly" | "monthly" | "quarterly";
  day_of_week?: number;
  day_of_month?: number;
  hour_utc: number;
  minute_utc: number;
}): { ok: true; cron: string } | { ok: false; message: string } {
  const minute = input.minute_utc;
  const hour = input.hour_utc;

  if (input.frequency === "weekly") {
    if (typeof input.day_of_week !== "number") {
      return { ok: false, message: "day_of_week is required for weekly schedules (0=Sun ... 6=Sat)." };
    }
    return { ok: true, cron: `${minute} ${hour} * * ${input.day_of_week}` };
  }

  if (input.frequency === "monthly") {
    if (typeof input.day_of_month !== "number") {
      return { ok: false, message: "day_of_month is required for monthly schedules (1-28)." };
    }
    return { ok: true, cron: `${minute} ${hour} ${input.day_of_month} * *` };
  }

  if (typeof input.day_of_month !== "number") {
    return { ok: false, message: "day_of_month is required for quarterly schedules (1-28)." };
  }

  return { ok: true, cron: `${minute} ${hour} ${input.day_of_month} 1,4,7,10 *` };
}
