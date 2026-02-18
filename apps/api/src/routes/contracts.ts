import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ExecBriefSchema, ReportContractSchema, ReportGuardrailsSchema } from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import type { AnalystClient, PlannerClient, QueryStrategistClient, ReportComposerClient } from "@project-overload/llm-client";
import { renderExecBriefHtml, renderPdfFromHtml } from "@project-overload/report-render";
import type { MetadataStore } from "../store";
import type { RuntimeConnectionManager } from "../dataplane/connection-manager";
import { runReportContractPipeline } from "../services/run-contract";

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
  app.post("/report-contracts", async (request, reply) => {
    const payload = toReportContract(request.body);
    const created = await store.createReportContract(payload);
    reply.code(201).send(created);
  });

  app.get("/report-contracts", async () => {
    return store.listReportContracts();
  });

  app.get("/report-contracts/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    return contract;
  });

  app.post("/report-contracts/:id/run", async (request, reply) => {
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    try {
      const catalogSummary = buildCatalogSummary(connectionManager);

      const result = await runReportContractPipeline({
        contract,
        store,
        data_plane: dataPlane,
        analyst_client: analystClient,
        query_strategist: queryStrategist,
        report_composer: reportComposer,
        planner_client: plannerClient,
        catalog_summary: catalogSummary
      });

      return reply.code(200).send({
        run_id: result.run.id,
        contract_id: id,
        exec_brief: result.exec_brief,
        exec_brief_html: result.html,
        planner_summary: result.planner_summary,
        pdf_path: `/report-runs/${result.run.id}/pdf`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Report pipeline failed";
      return reply.code(500).send({ message: `Report run failed: ${message}` });
    }
  });

  app.get("/report-contracts/:id/runs", async (request, reply) => {
    const { id } = request.params as { id: string };
    const contract = await store.getReportContract(id);

    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const runs = await store.listReportRuns(id);
    return reply.code(200).send(runs);
  });

  app.get("/report-runs/:runId", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await store.getReportRunById(runId);

    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    return reply.code(200).send(run);
  });

  app.get("/report-runs/:runId/pdf", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await store.getReportRunById(runId);

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

function toReportContract(body: unknown) {
  const payload = body as Record<string, unknown>;

  return ReportContractSchema.parse({
    id: typeof payload.id === "string" && payload.id.length > 0 ? payload.id : randomUUID(),
    name: payload.name,
    audience: payload.audience ?? "Executive",
    timezone: payload.timezone ?? "UTC",
    schedule_cron: payload.schedule_cron ?? null,
    sql_template: payload.sql_template ?? "SELECT * FROM analytics.sales",
    metric_ids: Array.isArray(payload.metric_ids) ? payload.metric_ids : [],
    dimension_ids: Array.isArray(payload.dimension_ids) ? payload.dimension_ids : [],
    insight_mode: typeof payload.insight_mode === "string" ? payload.insight_mode : "business",
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
