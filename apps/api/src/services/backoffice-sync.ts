import { randomUUID } from "node:crypto";
import type { ReportContract, ReportRun } from "@project-overload/shared";
import type {
  CustomerAccountRecord,
  InfraCostLedgerRecord,
  MetadataStore,
  OpenRouterBalanceHistoryRecord,
  SupportTicketRecord
} from "../store";
import type { OpenRouterBalanceSnapshot } from "./openrouter-balance";

const DEFAULT_TENANT_API_MONTHLY_COST_USD = 32.79;
const DEFAULT_TENANT_WORKER_MONTHLY_COST_USD = 32.79;
const DEFAULT_SHARED_PLATFORM_MONTHLY_COST_USD = 65.59;
const DEFAULT_METADATA_MONTHLY_COST_USD = 20;
const DEFAULT_OBSERVABILITY_MONTHLY_COST_USD = 12;
const DEFAULT_STORAGE_GB_PER_TENANT = 2;
const DEFAULT_STORAGE_COST_PER_GB_MONTH_USD = 0.015;
const DEFAULT_AI_INPUT_COST_PER_MILLION_USD = 5;
const DEFAULT_AI_OUTPUT_COST_PER_MILLION_USD = 15;

export type PeriodWindow = {
  key: string;
  label: string;
  start_iso: string;
  end_iso: string;
};

export type BackofficeSyncSummary = {
  tickets_created: number;
  tickets_updated: number;
  tickets_resolved: number;
  infra_costs_synced: number;
};

export async function syncBackofficeDerivedRecords(
  store: MetadataStore,
  now: Date = new Date()
): Promise<BackofficeSyncSummary> {
  const [accounts, contracts, runs, existingTickets] = await Promise.all([
    store.listCustomerAccounts(),
    store.listAllReportContracts(),
    store.listAllReportRuns(),
    store.listSupportTickets()
  ]);

  const financeSummary = await syncCurrentMonthInfraCostLedger(store, accounts, now);
  const supportSummary = await syncSupportTicketsFromRuns(store, accounts, contracts, runs, existingTickets, now);

  return {
    tickets_created: supportSummary.created,
    tickets_updated: supportSummary.updated,
    tickets_resolved: supportSummary.resolved,
    infra_costs_synced: financeSummary.infra_costs_synced
  };
}

export async function persistOpenRouterBalanceSnapshot(
  store: MetadataStore,
  balance: OpenRouterBalanceSnapshot,
  now: Date = new Date()
): Promise<OpenRouterBalanceHistoryRecord | null> {
  const latest = (await store.listOpenRouterBalanceHistory(1))[0] ?? null;
  if (latest) {
    const capturedAt = Date.parse(latest.captured_at);
    if (Number.isFinite(capturedAt) && now.getTime() - capturedAt < 10 * 60 * 1000) {
      const samePayload =
        latest.remaining_credits === balance.remaining_credits &&
        latest.total_credits === balance.total_credits &&
        latest.used_credits === balance.used_credits &&
        latest.source === balance.source &&
        latest.stale_reason === balance.stale_reason;
      if (samePayload) {
        return null;
      }
    }
  }

  return store.appendOpenRouterBalanceHistory({
    provider: "openrouter",
    remaining_credits: balance.remaining_credits,
    total_credits: balance.total_credits,
    used_credits: balance.used_credits,
    source: balance.source,
    stale_reason: balance.stale_reason
  });
}

export async function createManualSupportTicket(
  store: MetadataStore,
  input: {
    tenant_id: string;
    title: string;
    priority: SupportTicketRecord["priority"];
    category: string;
    requester_name?: string | null;
    requester_email?: string | null;
    assignee?: string | null;
    latest_message: string;
    due_at?: string | null;
  }
): Promise<SupportTicketRecord> {
  return store.upsertSupportTicket({
    id: randomUUID(),
    tenant_id: input.tenant_id,
    title: input.title.trim(),
    status: "open",
    priority: input.priority,
    category: input.category.trim(),
    requester_name: normalizeOptionalString(input.requester_name),
    requester_email: normalizeOptionalString(input.requester_email),
    assignee: normalizeOptionalString(input.assignee),
    latest_message: input.latest_message.trim(),
    source: "manual",
    due_at: normalizeOptionalString(input.due_at)
  });
}

export async function updateSupportTicketStatus(
  store: MetadataStore,
  input: {
    ticket_id: string;
    status: SupportTicketRecord["status"];
    assignee?: string | null;
    latest_message?: string | null;
    due_at?: string | null;
  }
): Promise<SupportTicketRecord | null> {
  const current = (await store.listSupportTickets()).find((ticket) => ticket.id === input.ticket_id) ?? null;
  if (!current) {
    return null;
  }

  return store.upsertSupportTicket({
    id: current.id,
    tenant_id: current.tenant_id,
    title: current.title,
    status: input.status,
    priority: current.priority,
    category: current.category,
    requester_name: current.requester_name,
    requester_email: current.requester_email,
    assignee: normalizeOptionalString(input.assignee) ?? current.assignee,
    latest_message: normalizeOptionalString(input.latest_message) ?? current.latest_message,
    source: current.source,
    due_at: normalizeOptionalString(input.due_at) ?? current.due_at,
    last_activity_at: new Date().toISOString()
  });
}

export function estimateRunsAiCostUsd(runs: ReportRun[]): number {
  const inputRatePerMillion = readEnvNumber(
    "CLARITECT_AI_INPUT_COST_PER_MILLION_USD",
    DEFAULT_AI_INPUT_COST_PER_MILLION_USD
  );
  const outputRatePerMillion = readEnvNumber(
    "CLARITECT_AI_OUTPUT_COST_PER_MILLION_USD",
    DEFAULT_AI_OUTPUT_COST_PER_MILLION_USD
  );

  let inputTokens = 0;
  let outputTokens = 0;
  for (const run of runs) {
    inputTokens += run.token_usage?.input_tokens ?? 0;
    outputTokens += run.token_usage?.output_tokens ?? 0;
  }

  return roundUsd((inputTokens / 1_000_000) * inputRatePerMillion + (outputTokens / 1_000_000) * outputRatePerMillion);
}

export function getUtcMonthWindow(now: Date): PeriodWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  const month = String(start.getUTCMonth() + 1).padStart(2, "0");
  const key = `${start.getUTCFullYear()}_${month}`;
  return {
    key,
    label: `${start.getUTCFullYear()}-${month}`,
    start_iso: start.toISOString(),
    end_iso: end.toISOString()
  };
}

async function syncCurrentMonthInfraCostLedger(
  store: MetadataStore,
  accounts: CustomerAccountRecord[],
  now: Date
): Promise<{ infra_costs_synced: number }> {
  const existingInfraCosts = await store.listInfraCostLedger();
  const activeTenantCount = Math.max(
    1,
    accounts.filter((account) => account.status === "active" || account.status === "trial").length
  );
  const period = getUtcMonthWindow(now);
  let infraCostsSynced = 0;

  for (const account of accounts) {
    const existingInfra = existingInfraCosts.find(
      (entry) =>
        entry.tenant_id === account.tenant_id &&
        getPeriodKeyFromIso(entry.period_start) === period.key
    );
    const infraCost = buildInfraCostRecord(account, activeTenantCount, period, existingInfra?.id ?? null);
    await store.upsertInfraCostLedger(infraCost);
    infraCostsSynced += 1;
  }

  return { infra_costs_synced: infraCostsSynced };
}

async function syncSupportTicketsFromRuns(
  store: MetadataStore,
  accounts: CustomerAccountRecord[],
  contracts: ReportContract[],
  runs: ReportRun[],
  existingTickets: SupportTicketRecord[],
  now: Date
): Promise<{ created: number; updated: number; resolved: number }> {
  let created = 0;
  let updated = 0;
  let resolved = 0;

  const accountByTenant = new Map(accounts.map((account) => [account.tenant_id, account] as const));
  const ticketById = new Map(existingTickets.map((ticket) => [ticket.id, ticket] as const));

  for (const contract of contracts) {
    const tenantId = contract.tenant_id ?? "default";
    const latestRun = runs
      .filter((run) => run.contract_id === contract.id && (run.tenant_id ?? "default") === tenantId)
      .sort(
        (left, right) =>
          Date.parse(right.finished_at ?? right.started_at) - Date.parse(left.finished_at ?? left.started_at)
      )[0];

    if (!latestRun) {
      continue;
    }

    const ticketId = buildSystemFailureTicketId(tenantId, contract.id);
    const existing = ticketById.get(ticketId) ?? null;
    const account = accountByTenant.get(tenantId) ?? null;

    if (latestRun.status === "failed") {
      const next = await store.upsertSupportTicket({
        id: ticketId,
        tenant_id: tenantId,
        title: `${contract.name} run failure`,
        status: "open",
        priority: latestRun.trigger === "scheduled" || latestRun.attempt > 1 ? "urgent" : "high",
        category: "report_run_failure",
        requester_name: account?.primary_contact_name ?? "System monitor",
        requester_email: account?.primary_contact_email ?? null,
        assignee: account?.owner ?? "Claritect Ops",
        latest_message: buildFailureMessage(contract, latestRun),
        source: "system",
        due_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        last_activity_at: latestRun.finished_at ?? latestRun.started_at
      });
      if (!existing) {
        created += 1;
      } else if (hasTicketChanged(existing, next)) {
        updated += 1;
      }
      ticketById.set(ticketId, next);
      continue;
    }

    if (existing && !isClosedTicket(existing)) {
      const next = await store.upsertSupportTicket({
        id: existing.id,
        tenant_id: existing.tenant_id,
        title: existing.title,
        status: "resolved",
        priority: existing.priority,
        category: existing.category,
        requester_name: existing.requester_name,
        requester_email: existing.requester_email,
        assignee: existing.assignee,
        latest_message: `Resolved automatically after a successful run at ${latestRun.finished_at ?? latestRun.started_at}.`,
        source: existing.source,
        due_at: null,
        last_activity_at: latestRun.finished_at ?? latestRun.started_at
      });
      if (hasTicketChanged(existing, next)) {
        resolved += 1;
      }
      ticketById.set(ticketId, next);
    }
  }

  return { created, updated, resolved };
}

function buildInfraCostRecord(
  account: CustomerAccountRecord,
  activeTenantCount: number,
  period: PeriodWindow,
  existingId: string | null
): Omit<InfraCostLedgerRecord, "created_at" | "updated_at"> {
  const apiCostBase = readEnvNumber("CLARITECT_TENANT_API_MONTHLY_COST_USD", DEFAULT_TENANT_API_MONTHLY_COST_USD);
  const workerCostBase = readEnvNumber(
    "CLARITECT_TENANT_WORKER_MONTHLY_COST_USD",
    DEFAULT_TENANT_WORKER_MONTHLY_COST_USD
  );
  const sharedPlatformMonthly =
    readEnvNumber("CLARITECT_SHARED_PLATFORM_MONTHLY_COST_USD", DEFAULT_SHARED_PLATFORM_MONTHLY_COST_USD) +
    readEnvNumber("CLARITECT_METADATA_MONTHLY_COST_USD", DEFAULT_METADATA_MONTHLY_COST_USD) +
    readEnvNumber("CLARITECT_OBSERVABILITY_MONTHLY_COST_USD", DEFAULT_OBSERVABILITY_MONTHLY_COST_USD);
  const storageGb = readEnvNumber("CLARITECT_STORAGE_GB_PER_TENANT", DEFAULT_STORAGE_GB_PER_TENANT);
  const storagePerGb = readEnvNumber(
    "CLARITECT_STORAGE_COST_PER_GB_MONTH_USD",
    DEFAULT_STORAGE_COST_PER_GB_MONTH_USD
  );
  const computeEnabled = account.status === "active" || account.status === "trial";

  const api_cost_usd = roundUsd(computeEnabled ? apiCostBase : 0);
  const worker_cost_usd = roundUsd(computeEnabled ? workerCostBase : 0);
  const storage_cost_usd = roundUsd(storageGb * storagePerGb);
  const platform_cost_usd = roundUsd(sharedPlatformMonthly / activeTenantCount);
  const total_cost_usd = roundUsd(api_cost_usd + worker_cost_usd + storage_cost_usd + platform_cost_usd);

  return {
    id: existingId ?? `infra_${sanitizeId(account.tenant_id)}_${period.key}`,
    tenant_id: account.tenant_id,
    period_start: period.start_iso,
    period_end: period.end_iso,
    api_cost_usd,
    worker_cost_usd,
    storage_cost_usd,
    platform_cost_usd,
    total_cost_usd,
    notes: `Auto-synced baseline dedicated runtime cost model for ${period.label}.`
  };
}

function buildSystemFailureTicketId(tenantId: string, contractId: string): string {
  return `ticket_${sanitizeId(tenantId)}_${sanitizeId(contractId)}_run_failure`;
}

function buildFailureMessage(contract: ReportContract, run: ReportRun): string {
  const error = extractRunErrorMessage(run);
  const triggerLabel = run.trigger === "scheduled" ? "scheduled" : run.trigger === "retry" ? "retry" : "manual";
  return `${contract.name} ${triggerLabel} run failed at ${run.finished_at ?? run.started_at}. ${error}`;
}

function extractRunErrorMessage(run: ReportRun): string {
  const queryPlan = typeof run.query_plan === "object" && run.query_plan ? (run.query_plan as Record<string, unknown>) : {};
  const execBrief = typeof run.exec_brief === "object" && run.exec_brief ? (run.exec_brief as Record<string, unknown>) : {};
  const candidates = [queryPlan.error, execBrief.error];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return "The run failed before a detailed error message was captured.";
}

function hasTicketChanged(left: SupportTicketRecord, right: SupportTicketRecord): boolean {
  return (
    left.status !== right.status ||
    left.priority !== right.priority ||
    left.assignee !== right.assignee ||
    left.latest_message !== right.latest_message ||
    left.due_at !== right.due_at ||
    left.last_activity_at !== right.last_activity_at
  );
}

function isClosedTicket(ticket: SupportTicketRecord): boolean {
  return ticket.status === "resolved" || ticket.status === "closed";
}

function getPeriodKeyFromIso(value: string): string | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}_${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
