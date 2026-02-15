import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { ExecBriefSchema, ReportContractSchema, ReportGuardrailsSchema } from "@project-overload/shared";
import type { DataPlane } from "@project-overload/dataplane";
import type { AnalystClient } from "@project-overload/llm-client";
import { renderExecBriefHtml, renderPdfFromHtml } from "@project-overload/report-render";
import type { MetadataStore } from "../store";
import { runReportContractPipeline } from "../services/run-contract";

export function registerContractRoutes(
  app: FastifyInstance,
  store: MetadataStore,
  dataPlane: DataPlane,
  analystClient: AnalystClient
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

    const result = await runReportContractPipeline({
      contract,
      store,
      data_plane: dataPlane,
      analyst_client: analystClient
    });

    return reply.code(200).send({
      run_id: result.run.id,
      contract_id: id,
      exec_brief: result.exec_brief,
      pdf_path: `/report-runs/${result.run.id}/pdf`
    });
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

    const execBrief = ExecBriefSchema.parse(run.exec_brief);
    const html = renderExecBriefHtml(execBrief);
    const pdf = await renderPdfFromHtml(html);

    return reply
      .code(200)
      .header("content-type", "application/pdf")
      .header("content-disposition", `attachment; filename="exec-brief-${run.id}.pdf"`)
      .send(pdf.bytes);
  });
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
    guardrails: ReportGuardrailsSchema.parse(payload.guardrails ?? {})
  });
}
