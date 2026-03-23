import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  ReportContractSchema,
  ScheduledReportFrequencySchema,
  ScheduledReportStatusSchema,
  ScheduledReportProfileSchema,
  type ReportContract,
  type ReportRun
} from "@project-overload/shared";
import { z } from "zod";
import type { MetadataStore } from "../store";
import { resolveRequestContext } from "../security/request-context";

const ScheduleDraftQuestionSchema = z.object({
  question_number: z.number().int().min(1),
  question_id: z.string().nullable().default(null),
  question_text: z.string().min(1),
  current_scope_summary: z.string().min(1),
  suggested_next_run_behavior: z.string().min(1)
});

const ScheduleProfileCreateSchema = z.object({
  frequency: ScheduledReportFrequencySchema,
  timezone: z.string().trim().min(1).optional(),
  day_of_week: z.number().int().min(0).max(6).optional(),
  day_of_month: z.number().int().min(1).max(28).optional(),
  hour_utc: z.number().int().min(0).max(23).default(9),
  minute_utc: z.number().int().min(0).max(59).default(0),
  windowing_instructions: z.string().trim().min(1),
  additional_instructions: z.string().trim().max(2000).default(""),
  question_execution_plan: z.array(
    z.object({
      question_number: z.number().int().min(1),
      next_run_behavior: z.string().trim().min(1)
    })
  ).min(1)
});

const ScheduleProfileStatusUpdateSchema = z.object({
  status: ScheduledReportStatusSchema
});

export function registerScheduledReportRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.get("/report-runs/:runId/schedule-draft", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { runId } = request.params as { runId: string };
    const run = await store.getReportRunById(runId, context);
    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    const contract = await store.getReportContract(run.contract_id, context);
    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const questionDrafts = buildScheduleDraftQuestions(run, contract);
    return reply.code(200).send({
      run_id: run.id,
      contract_id: contract.id,
      report_title: contract.name,
      timezone: contract.timezone,
      questions: questionDrafts,
      defaults: {
        frequency: "monthly",
        timezone: contract.timezone,
        hour_utc: 9,
        minute_utc: 0
      }
    });
  });

  app.post("/report-runs/:runId/schedule-profile", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { runId } = request.params as { runId: string };
    const parsed = ScheduleProfileCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid schedule profile payload",
        issues: parsed.error.issues
      });
    }

    const run = await store.getReportRunById(runId, context);
    if (!run) {
      return reply.code(404).send({ message: "Report run not found" });
    }

    const contract = await store.getReportContract(run.contract_id, context);
    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const schedule = buildScheduleCron(parsed.data);
    if (!schedule.ok) {
      return reply.code(400).send({ message: schedule.message });
    }

    const draftQuestions = buildScheduleDraftQuestions(run, contract);
    const draftQuestionsByNumber = new Map(draftQuestions.map((entry) => [entry.question_number, entry]));
    const queryTemplateSnapshot = extractScheduledQueryTemplates(run);
    const nowIso = new Date().toISOString();
    const timezone = parsed.data.timezone ?? contract.timezone;

    const profile = ScheduledReportProfileSchema.parse({
      id: `sched_${randomUUID()}`,
      tenant_id: context.tenant_id,
      contract_id: contract.id,
      source_run_id: run.id,
      report_title: contract.name,
      frequency: parsed.data.frequency,
      timezone,
      day_of_week: parsed.data.day_of_week ?? null,
      day_of_month: parsed.data.day_of_month ?? null,
      hour_utc: parsed.data.hour_utc,
      minute_utc: parsed.data.minute_utc,
      schedule_cron: schedule.cron,
      windowing_instructions: parsed.data.windowing_instructions,
      additional_instructions: parsed.data.additional_instructions,
      question_execution_plan: parsed.data.question_execution_plan.map((entry) => {
        const draft = draftQuestionsByNumber.get(entry.question_number);
        return {
          question_id: draft?.question_id ?? null,
          question_number: entry.question_number,
          question_text: draft?.question_text ?? `Question ${entry.question_number}`,
          current_scope_summary: draft?.current_scope_summary ?? "Reuse the saved scoped question and governed query plan.",
          next_run_behavior: entry.next_run_behavior,
          query_template_count: queryTemplateSnapshot.filter((item) => item.question_number === entry.question_number).length
        };
      }),
      query_template_snapshot: queryTemplateSnapshot,
      report_template_html: typeof run.report_html === "string" ? run.report_html : "",
      status: "active",
      created_at: nowIso,
      updated_at: nowIso
    });

    const updatedContract = ReportContractSchema.parse({
      ...contract,
      tenant_id: context.tenant_id,
      timezone,
      schedule_cron: schedule.cron,
      lifecycle_status: "locked",
      locked_at: contract.locked_at ?? nowIso,
      locked_by: contract.locked_by ?? context.actor_id ?? "system",
      contract_version: (contract.contract_version ?? 0) + 1
    });

    await store.upsertScheduledReportProfile(profile, context);
    await store.createReportContract(updatedContract, context);
    await store.createReportContractVersion(updatedContract.id, updatedContract, "scheduled report profile updated", context);
    await store.appendAuditLog(
      "scheduled_report_profile_upserted",
      {
        contract_id: contract.id,
        run_id: run.id,
        frequency: parsed.data.frequency,
        timezone,
        schedule_cron: schedule.cron,
        question_count: profile.question_execution_plan.length,
        actor_id: context.actor_id
      },
      context
    );

    return reply.code(200).send({
      profile,
      understanding: {
        report_title: profile.report_title,
        frequency: profile.frequency,
        timezone: profile.timezone,
        schedule_cron: profile.schedule_cron,
        questions: profile.question_execution_plan
      }
    });
  });

  app.get("/scheduled-reports", async (request, reply) => {
    const context = resolveRequestContext(request);
    const profiles = await store.listScheduledReportProfiles(context);
    const items = await Promise.all(
      profiles.map(async (profile) => {
        const contract = await store.getReportContract(profile.contract_id, context);
        const runs = await store.listReportRuns(profile.contract_id, context);
        const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
        return {
          contract_id: profile.contract_id,
          profile_id: profile.id,
          report_title: profile.report_title,
          status: profile.status,
          frequency: profile.frequency,
          timezone: profile.timezone,
          schedule_cron: profile.schedule_cron,
          question_count: profile.question_execution_plan.length,
          run_count: runs.length,
          latest_run_id: latestRun?.id ?? null,
          latest_run_at: latestRun?.finished_at ?? latestRun?.started_at ?? null,
          latest_status: latestRun?.status ?? null,
          contract_name: contract?.name ?? profile.report_title,
          updated_at: profile.updated_at ?? profile.created_at ?? null
        };
      })
    );

    return reply.code(200).send({ items });
  });

  app.get("/scheduled-reports/:contractId", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { contractId } = request.params as { contractId: string };
    const profile = await store.getScheduledReportProfileByContractId(contractId, context);
    if (!profile) {
      return reply.code(404).send({ message: "Scheduled report not found" });
    }

    const contract = await store.getReportContract(contractId, context);
    const runs = await store.listReportRuns(contractId, context);
    const sortedRuns = [...runs].sort(
      (left, right) =>
        Date.parse(right.finished_at ?? right.started_at) - Date.parse(left.finished_at ?? left.started_at)
    );

    return reply.code(200).send({
      profile,
      contract,
      runs: sortedRuns.map((run) => toRunSummary(run))
    });
  });

  app.post("/scheduled-reports/:contractId/status", async (request, reply) => {
    const context = resolveRequestContext(request);
    const { contractId } = request.params as { contractId: string };
    const parsed = ScheduleProfileStatusUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid scheduled report status payload",
        issues: parsed.error.issues
      });
    }

    const profile = await store.getScheduledReportProfileByContractId(contractId, context);
    if (!profile) {
      return reply.code(404).send({ message: "Scheduled report not found" });
    }

    const contract = await store.getReportContract(contractId, context);
    if (!contract) {
      return reply.code(404).send({ message: "Report contract not found" });
    }

    const nowIso = new Date().toISOString();
    const nextStatus = parsed.data.status;
    const updatedProfile = ScheduledReportProfileSchema.parse({
      ...profile,
      status: nextStatus,
      updated_at: nowIso
    });

    const updatedContract = ReportContractSchema.parse({
      ...contract,
      tenant_id: context.tenant_id,
      schedule_cron: nextStatus === "active" ? profile.schedule_cron : null,
      lifecycle_status: nextStatus === "active" ? "locked" : (contract.lifecycle_status ?? "locked"),
      contract_version: (contract.contract_version ?? 0) + 1
    });

    await store.upsertScheduledReportProfile(updatedProfile, context);
    await store.createReportContract(updatedContract, context);
    await store.createReportContractVersion(
      updatedContract.id,
      updatedContract,
      nextStatus === "active" ? "scheduled report activated" : "scheduled report paused",
      context
    );
    await store.appendAuditLog(
      "scheduled_report_status_updated",
      {
        contract_id: contractId,
        profile_id: profile.id,
        status: nextStatus,
        actor_id: context.actor_id
      },
      context
    );

    return reply.code(200).send({
      profile: updatedProfile,
      contract: updatedContract
    });
  });
}

function buildScheduleDraftQuestions(run: ReportRun, contract: ReportContract) {
  const preparedPayloads = parsePreparedPayloads(run.query_plan);
  if (preparedPayloads.length > 0) {
    return preparedPayloads.map((payload) =>
      ScheduleDraftQuestionSchema.parse({
        question_number: payload.question_number,
        question_id: payload.question_id,
        question_text: payload.question,
        current_scope_summary: buildCurrentScopeSummary(payload, contract),
        suggested_next_run_behavior: buildSuggestedNextRunBehavior(payload.question, contract.timezone)
      })
    );
  }

  return (contract.scope_clarifications ?? []).map((entry) =>
    ScheduleDraftQuestionSchema.parse({
      question_number: entry.question_number,
      question_id: null,
      question_text: entry.question,
      current_scope_summary: entry.answer,
      suggested_next_run_behavior: buildSuggestedNextRunBehavior(entry.question, contract.timezone)
    })
  );
}

function parsePreparedPayloads(queryPlan: Record<string, unknown>) {
  const parsed = z.array(
    z.object({
      question_id: z.string().min(1),
      question_number: z.number().int().min(1),
      question: z.string().min(1),
      purpose: z.string().min(1),
      warnings: z.array(z.string()).default([]),
      validation: z
        .object({
          expected_months: z.number().int().min(1).nullable().optional(),
          observed_months: z.number().int().min(0),
          missing_months: z.array(z.string()).default([])
        })
        .optional()
    })
  ).safeParse(queryPlan["prepared_payloads"]);

  return parsed.success ? parsed.data : [];
}

function extractScheduledQueryTemplates(run: ReportRun) {
  const parsed = z.array(
    z.object({
      question_number: z.number().int().min(1),
      question: z.string().min(1),
      purpose: z.string().min(1),
      sql: z.string().min(1),
      group_id: z.string().optional().nullable()
    })
  ).safeParse(run.query_plan["strategy_queries"]);

  if (!parsed.success) {
    return [];
  }

  return parsed.data.map((detail, index) => ({
    question_id: null,
    question_number: detail.question_number,
    question: detail.question,
    purpose: detail.purpose,
    sql: detail.sql,
    group_id: detail.group_id ?? null,
    template_order: index
  })).map((entry) => ({
    question_id: entry.question_id,
    question_number: entry.question_number,
    question: entry.question,
    purpose: entry.purpose,
    sql: entry.sql,
    group_id: entry.group_id
  }));
}

function buildCurrentScopeSummary(
  payload: {
    question: string;
    purpose: string;
    validation?: {
      expected_months?: number | null;
      observed_months: number;
      missing_months: string[];
    };
    warnings: string[];
  },
  contract: ReportContract
): string {
  const notes: string[] = [`Purpose: ${payload.purpose}.`];
  if (payload.validation?.expected_months) {
    notes.push(
      `The current prepared view expects ${payload.validation.expected_months} periods and observed ${payload.validation.observed_months}.`
    );
  }
  if (payload.validation && payload.validation.missing_months.length > 0) {
    notes.push(`Coverage gaps flagged: ${payload.validation.missing_months.join(", ")}.`);
  }
  if (payload.warnings.length > 0) {
    notes.push(`Warnings: ${payload.warnings.slice(0, 2).join(" ")}`);
  }
  if (contract.scope_clarifications.length > 0) {
    const matching = contract.scope_clarifications.find(
      (entry) => entry.question.trim().toLowerCase() === payload.question.trim().toLowerCase()
    );
    if (matching) {
      notes.push(`Clarified scope: ${matching.answer}`);
    }
  }
  return notes.join(" ");
}

function buildSuggestedNextRunBehavior(question: string, timezone: string): string {
  return `Run the same question again, roll the reporting window forward for the next scheduled period in ${timezone}, and keep the analysis logic otherwise unchanged unless explicitly overridden. Question: ${question}`;
}

function toRunSummary(run: ReportRun) {
  return {
    run_id: run.id,
    status: run.status,
    trigger: run.trigger,
    started_at: run.started_at,
    finished_at: run.finished_at,
    has_report_html: typeof run.report_html === "string" && run.report_html.length > 0
  };
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
