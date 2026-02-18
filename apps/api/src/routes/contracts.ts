import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ContractLifecycleStatusSchema,
  ExecBriefSchema,
  ReportContractSchema,
  ReportContractDeliverySchema,
  ReportGuardrailsSchema
} from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import type { AnalystClient, PlannerClient, QueryStrategistClient, ReportComposerClient } from "@project-overload/llm-client";
import { renderExecBriefHtml, renderPdfFromHtml } from "@project-overload/report-render";
import type { MetadataStore } from "../store";
import type { RuntimeConnectionManager } from "../dataplane/connection-manager";
import { resolveRequestContext } from "../security/request-context";
import {
  answerRunPayloadQuestion,
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

    try {
      const catalogSummary = buildCatalogSummary(connectionManager);

      const result = await runReportContractPipeline({
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
        planner_client: plannerClient,
        catalog_summary: catalogSummary
      });
      const delivery = await deliverReportRun({
        contract,
        run: result.run,
        exec_brief: result.exec_brief
      });
      const runWithDelivery = {
        ...result.run,
        delivery
      };
      await store.createReportRun(runWithDelivery, context);
      await store.appendAuditLog(
        "report_delivery_attempt",
        {
          contract_id: id,
          run_id: result.run.id,
          status: delivery.status,
          provider: delivery.provider,
          recipients: delivery.recipients,
          error: delivery.error
        },
        context
      );

      return reply.code(200).send({
        run_id: result.run.id,
        contract_id: id,
        exec_brief: result.exec_brief,
        exec_brief_html: result.html,
        planner_summary: result.planner_summary,
        concise_summary: result.concise_summary,
        prepared_payloads: result.prepared_payloads,
        token_usage: result.token_usage,
        lifecycle_status: contract.lifecycle_status ?? "draft",
        contract_version: contract.contract_version ?? 1,
        trigger,
        attempt,
        delivery,
        pdf_path: `/report-runs/${result.run.id}/pdf`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Report pipeline failed";
      return reply.code(500).send({ message: `Report run failed: ${message}` });
    }
  });

  app.post("/report-contracts/:id/prepare", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id, context);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    try {
      const catalogSummary = buildCatalogSummary(connectionManager);
      const result = await prepareReportContractData({
        contract,
        tenant_id: context.tenant_id,
        store,
        data_plane: dataPlane,
        query_strategist: queryStrategist,
        planner_client: plannerClient,
        catalog_summary: catalogSummary
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
          row_count_before_reduction: payload.row_count_before_reduction,
          prepared_row_count: payload.prepared_row_count,
          validation: payload.validation,
          preparation_notes: payload.preparation_notes,
          warnings: payload.warnings
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

    return reply.code(200).send(run);
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

    const answer = answerRunPayloadQuestion({
      run,
      question: parsed.data.question
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
    if (contract.lifecycle_status !== "locked") {
      return reply.code(409).send({ message: "Contract must be locked before scheduling." });
    }

    const parsed = z.object({
      frequency: z.enum(["weekly", "monthly", "quarterly"]),
      timezone: z.string().min(1).optional(),
      day_of_week: z.number().int().min(0).max(6).optional(),
      day_of_month: z.number().int().min(1).max(28).optional(),
      hour_utc: z.number().int().min(0).max(23).default(9),
      minute_utc: z.number().int().min(0).max(59).default(0)
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

    const timezone = parsed.data.timezone ?? contract.timezone;
    const updated = toReportContract(
      {
      ...contract,
      timezone,
      schedule_cron: schedule.cron
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

      const customerFacingHtml = stripConfidenceFromCustomerHtml(html);
      const pdf = await renderPdfFromHtml(customerFacingHtml);

      return reply
        .code(200)
        .header("content-type", "application/pdf")
        .header("content-disposition", `attachment; filename="report-${run.id}.pdf"`)
        .send(pdf.bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF generation failed";
      return reply.code(500).send({ message });
    }
  });
}

function stripConfidenceFromCustomerHtml(html: string): string {
  return html
    .replace(/<[^>]*class=["'][^"']*\bconfidence\b[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "")
    .replace(/<p[^>]*>\s*Confidence\s*:[^<]*<\/p>/gi, "")
    .replace(/<li[^>]*>\s*Confidence\s*:[^<]*<\/li>/gi, "")
    .replace(/<strong[^>]*>\s*Confidence\s*:?\s*<\/strong>/gi, "")
    .replace(/\bConfidence\s*:\s*\d+(?:\.\d+)?%?/gi, "");
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
    guardrails: ReportGuardrailsSchema.parse(payload.guardrails ?? {})
  });
}

function buildCatalogSummary(connectionManager: RuntimeConnectionManager): string {
  const catalog = connectionManager.getCatalog();
  if (!catalog || !catalog.tables || catalog.tables.length === 0) {
    return "No catalog available.";
  }

  const sections: string[] = [];
  sections.push(`BUSINESS_ID: ${catalog.business_id}`);
  sections.push("");

  for (const table of catalog.tables.slice(0, 20)) {
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
