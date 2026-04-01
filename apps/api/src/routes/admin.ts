import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ReportRun } from "@project-overload/shared";
import { z } from "zod";
import type {
  CustomerAccountRecord,
  MetadataStore,
  PlatformUserRecord,
  SupportTicketRecord
} from "../store";
import { resolveRequestContext } from "../security/request-context";
import { fetchOpenRouterBalance } from "../services/openrouter-balance";
import {
  createManualSupportTicket,
  estimateRunsAiCostUsd,
  getUtcMonthWindow,
  persistOpenRouterBalanceSnapshot,
  syncBackofficeDerivedRecords,
  updateSupportTicketStatus
} from "../services/backoffice-sync";

const CONNECTION_STATE_KEY = "runtime_connection_v1";
type ConnectionSummaryRow = {
  tenant_id: string;
  name: string;
  provider: string;
  database: string | null;
  allowlist_count: number;
  connected_at: string | null;
  updated_at: string;
};

export function registerAdminRoutes(app: FastifyInstance, store: MetadataStore): void {
  app.get("/admin/overview", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    await syncBackofficeDerivedRecords(store);

    const [accounts, users, contracts, runs, schedules, connectionStates, tickets, infraCosts, balance] =
      await Promise.all([
        store.listCustomerAccounts(),
        store.listPlatformUsers(),
        store.listAllReportContracts(),
        store.listAllReportRuns(),
        store.listAllScheduledReportProfiles(),
        store.listSystemStatesByKey(CONNECTION_STATE_KEY),
        store.listSupportTickets(),
        store.listInfraCostLedger(),
        fetchOpenRouterBalance()
      ]);
    const connections = buildConnectionSummaryRows(connectionStates);
    const accountRows = buildAccountSummaryRows({
      accounts,
      users,
      contracts,
      runs,
      schedules,
      connections,
      tickets,
      infraCosts
    });
    const recentTickets = buildSupportRows(tickets, accounts).slice(0, 6);
    const creditWatch = buildCreditWatchRows(accountRows).slice(0, 6);

    await persistOpenRouterBalanceSnapshot(store, balance);

    const urgentTickets = tickets.filter((ticket) => ticket.priority === "urgent" && !isClosedTicket(ticket)).length;
    const openTickets = tickets.filter((ticket) => !isClosedTicket(ticket)).length;
    const accountsNearLimits = accountRows.filter((row) => isAccountNearLimit(row)).length;
    const latestHistory = await store.listOpenRouterBalanceHistory(12);

    return reply.code(200).send({
      overview: {
        customers: accounts.length,
        active_customers: accounts.filter((entry) => entry.status === "active").length,
        users: users.length,
        active_users: users.filter((entry) => entry.is_active).length,
        connections: connections.length,
        report_contracts: contracts.length,
        report_runs: runs.length,
        failed_runs: runs.filter((entry) => entry.status === "failed").length,
        active_schedules: schedules.filter((entry) => entry.status === "active").length,
        paused_schedules: schedules.filter((entry) => entry.status === "paused").length,
        open_tickets: openTickets,
        urgent_tickets: urgentTickets,
        accounts_near_limits: accountsNearLimits,
        current_period_report_runs: accountRows.reduce((sum, row) => sum + row.current_period_report_runs, 0),
        latest_infra_cost_usd: roundUsd(infraCosts.reduce((sum, entry) => sum + entry.total_cost_usd, 0))
      },
      openrouter_balance: balance,
      openrouter_history: latestHistory,
      watchlist: accountRows
        .map((row) => ({ ...row, risk_score: computeAccountRiskScore(row) }))
        .sort((left, right) => {
          if (right.risk_score !== left.risk_score) {
            return right.risk_score - left.risk_score;
          }
          return Date.parse(right.last_activity_at ?? "") - Date.parse(left.last_activity_at ?? "");
        })
        .slice(0, 6),
      recent_tickets: recentTickets,
      credit_watch: creditWatch
    });
  });

  app.get("/admin/accounts", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    await syncBackofficeDerivedRecords(store);

    const [accounts, users, contracts, runs, schedules, connectionStates, tickets, infraCosts] =
      await Promise.all([
        store.listCustomerAccounts(),
        store.listPlatformUsers(),
        store.listAllReportContracts(),
        store.listAllReportRuns(),
        store.listAllScheduledReportProfiles(),
        store.listSystemStatesByKey(CONNECTION_STATE_KEY),
        store.listSupportTickets(),
        store.listInfraCostLedger()
      ]);
    const connections = buildConnectionSummaryRows(connectionStates);

    const items = buildAccountSummaryRows({
      accounts,
      users,
      contracts,
      runs,
      schedules,
      connections,
      tickets,
      infraCosts
    });

    return reply.code(200).send({
      summary: {
        accounts: items.length,
        active_accounts: items.filter((entry) => entry.account_status === "active").length,
        total_users: items.reduce((sum, entry) => sum + entry.user_count, 0),
        total_connections: items.reduce((sum, entry) => sum + entry.connection_count, 0),
        total_report_runs: items.reduce((sum, entry) => sum + entry.report_runs, 0),
        current_period_report_runs: items.reduce((sum, entry) => sum + entry.current_period_report_runs, 0),
        total_active_schedules: items.reduce((sum, entry) => sum + entry.active_schedules, 0),
        open_tickets: items.reduce((sum, entry) => sum + entry.open_tickets, 0),
        accounts_near_limits: items.filter((entry) => isAccountNearLimit(entry)).length
      },
      items
    });
  });

  app.get("/admin/accounts/:tenantId", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    await syncBackofficeDerivedRecords(store);

    const params = z.object({ tenantId: z.string().trim().min(1) }).safeParse(request.params ?? {});
    if (!params.success) {
      return reply.code(400).send({ message: "Invalid account id.", issues: params.error.issues });
    }

    const tenantId = params.data.tenantId;
    const [accounts, users, contracts, runs, schedules, connectionStates, tickets, infraCosts] =
      await Promise.all([
        store.listCustomerAccounts(),
        store.listPlatformUsers(),
        store.listAllReportContracts(),
        store.listAllReportRuns(),
        store.listAllScheduledReportProfiles(),
        store.listSystemStatesByKey(CONNECTION_STATE_KEY),
        store.listSupportTickets(),
        store.listInfraCostLedger()
      ]);
    const account = accounts.find((entry) => entry.tenant_id === tenantId) ?? null;
    if (!account) {
      return reply.code(404).send({ message: "Account not found." });
    }

    const connections = buildConnectionSummaryRows(connectionStates);
    const summary =
      buildAccountSummaryRows({
        accounts,
        users,
        contracts,
        runs,
        schedules,
        connections,
        tickets,
        infraCosts
      }).find((entry) => entry.tenant_id === tenantId) ?? null;
    const tenantUsers = users
      .filter((entry) => entry.tenant_id === tenantId)
      .sort((left, right) => Date.parse(right.last_login_at ?? "") - Date.parse(left.last_login_at ?? ""));
    const tenantConnections = connections.filter((entry) => entry.tenant_id === tenantId);
    const tenantTickets = buildSupportRows(
      tickets.filter((entry) => entry.tenant_id === tenantId),
      accounts
    ).slice(0, 8);
    const tenantInfraCosts = infraCosts
      .filter((entry) => entry.tenant_id === tenantId)
      .sort((left, right) => Date.parse(right.period_end) - Date.parse(left.period_end))
      .slice(0, 6);

    return reply.code(200).send({
      account: summary,
      profile: {
        ...account,
        name: displayAccountName(account),
        primary_contact_name: displayPrimaryContactName(account),
        primary_contact_email: displayPrimaryContactEmail(account),
        owner: displayOwnerName(account)
      },
      usage: summary
        ? {
            current_period_report_runs: summary.current_period_report_runs,
            current_period_total_tokens: summary.current_period_total_tokens,
            estimated_ai_cost_usd: summary.estimated_ai_cost_usd,
            remaining_report_credits: summary.remaining_report_credits,
            remaining_schedule_credits: summary.remaining_schedule_credits,
            remaining_ai_credits_usd: summary.remaining_ai_credits_usd
          }
        : null,
      users: tenantUsers.map((entry) => ({
        id: entry.id,
        username: entry.username,
        display_name: entry.display_name,
        role: entry.role,
        is_active: entry.is_active,
        last_login_at: entry.last_login_at
      })),
      connections: tenantConnections,
      recent_tickets: tenantTickets,
      recent_infra_costs: tenantInfraCosts
    });
  });

  app.get("/admin/support", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    await syncBackofficeDerivedRecords(store);

    const [tickets, accounts] = await Promise.all([store.listSupportTickets(), store.listCustomerAccounts()]);
    const rows = buildSupportRows(tickets, accounts);

    return reply.code(200).send({
      summary: {
        total: rows.length,
        open: rows.filter((ticket) => ticket.status === "open").length,
        pending: rows.filter((ticket) => ticket.status === "pending").length,
        urgent: rows.filter((ticket) => ticket.priority === "urgent" && !isClosedTicket(ticket)).length,
        resolved: rows.filter((ticket) => ticket.status === "resolved").length
      },
      account_options: accounts
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((account) => ({
          tenant_id: account.tenant_id,
          name: displayAccountName(account),
          owner: displayOwnerName(account),
          primary_contact_email: displayPrimaryContactEmail(account)
        })),
      items: rows
    });
  });

  app.post("/admin/support", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const parsed = z
      .object({
        tenant_id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
        category: z.string().trim().min(1).default("general"),
        requester_name: z.string().trim().min(1).nullable().optional(),
        requester_email: z.string().trim().email().nullable().optional(),
        assignee: z.string().trim().min(1).nullable().optional(),
        latest_message: z.string().trim().min(1),
        due_at: z.string().datetime().nullable().optional()
      })
      .safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid support ticket payload.", issues: parsed.error.issues });
    }

    const ticket = await createManualSupportTicket(store, parsed.data);
    await store.appendAuditLog(
      "admin_support_ticket_created",
      {
        ticket_id: ticket.id,
        tenant_id: ticket.tenant_id,
        title: ticket.title,
        actor_id: admin.id
      },
      resolveRequestContext(request)
    );

    return reply.code(201).send({ ticket });
  });

  app.post("/admin/support/:ticketId/status", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const params = z.object({ ticketId: z.string().trim().min(1) }).safeParse(request.params ?? {});
    const parsed = z
      .object({
        status: z.enum(["open", "pending", "resolved", "closed"]),
        assignee: z.string().trim().min(1).nullable().optional(),
        latest_message: z.string().trim().min(1).nullable().optional(),
        due_at: z.string().datetime().nullable().optional()
      })
      .safeParse(request.body ?? {});

    if (!params.success || !parsed.success) {
      return reply.code(400).send({
        message: "Invalid support ticket status payload.",
        issues: [
          ...(params.success ? [] : params.error.issues),
          ...(parsed.success ? [] : parsed.error.issues)
        ]
      });
    }

    const ticket = await updateSupportTicketStatus(store, {
      ticket_id: params.data.ticketId,
      ...parsed.data
    });
    if (!ticket) {
      return reply.code(404).send({ message: "Support ticket not found." });
    }

    await store.appendAuditLog(
      "admin_support_ticket_status_updated",
      {
        ticket_id: ticket.id,
        tenant_id: ticket.tenant_id,
        status: ticket.status,
        actor_id: admin.id
      },
      resolveRequestContext(request)
    );

    return reply.code(200).send({ ticket });
  });

  app.get("/admin/finance", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    await syncBackofficeDerivedRecords(store);

    const [accounts, users, contracts, runs, schedules, connectionStates, tickets, infraCosts, balance] = await Promise.all([
      store.listCustomerAccounts(),
      store.listPlatformUsers(),
      store.listAllReportContracts(),
      store.listAllReportRuns(),
      store.listAllScheduledReportProfiles(),
      store.listSystemStatesByKey(CONNECTION_STATE_KEY),
      store.listSupportTickets(),
      store.listInfraCostLedger(),
      fetchOpenRouterBalance()
    ]);
    await persistOpenRouterBalanceSnapshot(store, balance);
    const balanceHistory = await store.listOpenRouterBalanceHistory(20);
    const accountRows = buildAccountSummaryRows({
      accounts,
      users,
      contracts,
      runs,
      schedules,
      connections: buildConnectionSummaryRows(connectionStates),
      tickets,
      infraCosts
    });
    const accountNameByTenant = new Map(accounts.map((account) => [account.tenant_id, displayAccountName(account)] as const));

    return reply.code(200).send({
      summary: {
        accounts: accountRows.length,
        current_period_report_runs: accountRows.reduce((sum, row) => sum + row.current_period_report_runs, 0),
        report_run_capacity: accountRows.reduce((sum, row) => sum + row.monthly_runs_limit, 0),
        accounts_near_limits: accountRows.filter((row) => isAccountNearLimit(row)).length,
        infra_cost_total_usd: roundUsd(infraCosts.reduce((sum, entry) => sum + entry.total_cost_usd, 0)),
        openrouter_remaining_credits: balance.remaining_credits
      },
      balance,
      history: balanceHistory,
      credit_accounts: buildCreditWatchRows(accountRows),
      infra_costs: infraCosts.map((entry) => ({
        ...entry,
        account_name: accountNameByTenant.get(entry.tenant_id) ?? entry.tenant_id
      }))
    });
  });

  // Legacy endpoints kept for compatibility with older internal views.
  app.get("/admin/customers", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    const accounts = await store.listCustomerAccounts();
    const users = await store.listPlatformUsers();
    const contracts = await store.listAllReportContracts();
    const schedules = await store.listAllScheduledReportProfiles();

    return reply.code(200).send({
      items: accounts.map((account) => ({
        ...account,
        name: displayAccountName(account),
        primary_contact_name: displayPrimaryContactName(account),
        primary_contact_email: displayPrimaryContactEmail(account),
        owner: displayOwnerName(account),
        user_count: users.filter((user) => user.tenant_id === account.tenant_id && user.role === "customer").length,
        contract_count: contracts.filter((contract) => (contract.tenant_id ?? "default") === account.tenant_id).length,
        schedule_count: schedules.filter((schedule) => (schedule.tenant_id ?? "default") === account.tenant_id).length
      }))
    });
  });

  app.get("/admin/users", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    return reply.code(200).send({
      items: await store.listPlatformUsers()
    });
  });

  app.get("/admin/connections", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const states = await store.listSystemStatesByKey(CONNECTION_STATE_KEY);
    return reply.code(200).send({
      items: states.map((entry) => {
        const payload = entry.payload ?? {};
        const allowlistedRelations = Array.isArray(payload.allowed_relations)
          ? payload.allowed_relations.filter((value): value is string => typeof value === "string")
          : [];
        return {
          tenant_id: entry.tenant_id,
          name: typeof payload.name === "string" ? payload.name : "Connected source",
          provider: typeof payload.provider === "string" ? payload.provider : "unknown",
          database: typeof payload.database === "string" ? payload.database : null,
          allowlist_count: allowlistedRelations.length,
          connected_at: typeof payload.connected_at === "string" ? payload.connected_at : null,
          updated_at: entry.updated_at
        };
      })
    });
  });

  app.get("/admin/reports", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    const [contracts, runs] = await Promise.all([store.listAllReportContracts(), store.listAllReportRuns()]);

    return reply.code(200).send({
      items: contracts.map((contract) => {
        const contractRuns = runs.filter((run) => run.contract_id === contract.id);
        const latestRun =
          contractRuns
            .slice()
            .sort(
              (left, right) =>
                Date.parse(right.finished_at ?? right.started_at) -
                Date.parse(left.finished_at ?? left.started_at)
            )[0] ?? null;
        return {
          id: contract.id,
          tenant_id: contract.tenant_id ?? "default",
          name: contract.name,
          audience: contract.audience,
          lifecycle_status: contract.lifecycle_status ?? "draft",
          run_count: contractRuns.length,
          latest_run_id: latestRun?.id ?? null,
          latest_run_status: latestRun?.status ?? null,
          latest_run_at: latestRun?.finished_at ?? latestRun?.started_at ?? null
        };
      })
    });
  });

  app.get("/admin/schedules", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }

    const profiles = await store.listAllScheduledReportProfiles();
    return reply.code(200).send({
      items: profiles.map((profile) => ({
        contract_id: profile.contract_id,
        profile_id: profile.id,
        tenant_id: profile.tenant_id ?? "default",
        report_title: profile.report_title,
        status: profile.status,
        frequency: profile.frequency,
        timezone: profile.timezone,
        local_run_time: `${String(profile.hour_local).padStart(2, "0")}:${String(profile.minute_local).padStart(2, "0")}`,
        schedule_cron: profile.schedule_cron,
        next_run_at:
          profile.status === "active"
            ? computeNextScheduledRunIso(profile.schedule_cron, profile.timezone)
            : null,
        question_count: profile.question_execution_plan.length,
        updated_at: profile.updated_at ?? profile.created_at ?? null
      }))
    });
  });

  app.get("/admin/billing", async (request, reply) => {
    const admin = await requireAdminUser(store, request);
    if (!admin) {
      return reply.code(401).send({ message: "Unauthorized admin session." });
    }
    const accounts = await store.listCustomerAccounts();
    return reply.code(200).send({
      items: accounts.map((account) => ({
        tenant_id: account.tenant_id,
        name: displayAccountName(account),
        plan_tier: account.plan_tier,
        billing_status: account.billing_status,
        renewal_date: account.renewal_date,
        entitlements: account.entitlements
      }))
    });
  });
}

async function requireAdminUser(store: MetadataStore, request: FastifyRequest): Promise<PlatformUserRecord | null> {
  const context = resolveRequestContext(request);
  const username = readHeaderValue(request.headers["x-ui-user"]);
  if (!username) {
    return null;
  }
  const user = await store.getPlatformUserByUsername(username, context);
  if (!user || !user.is_active || user.role !== "admin") {
    return null;
  }
  return user;
}

function buildAccountSummaryRows(input: {
  accounts: CustomerAccountRecord[];
  users: PlatformUserRecord[];
  contracts: Array<{ id: string; tenant_id?: string; name: string }>;
  runs: ReportRun[];
  schedules: Array<{ tenant_id?: string; status: string }>;
  connections: ConnectionSummaryRow[];
  tickets: SupportTicketRecord[];
  infraCosts: Array<{ tenant_id: string; period_end: string; total_cost_usd: number }>;
}) {
  const period = getUtcMonthWindow(new Date());
  return input.accounts.map((account) => {
    const tenantId = account.tenant_id;
    const tenantUsers = input.users.filter((user) => user.tenant_id === tenantId && user.role === "customer");
    const tenantContracts = input.contracts.filter((contract) => (contract.tenant_id ?? "default") === tenantId);
    const tenantRuns = input.runs.filter((run) => (run.tenant_id ?? "default") === tenantId);
    const tenantSchedules = input.schedules.filter((schedule) => (schedule.tenant_id ?? "default") === tenantId);
    const tenantConnections = input.connections.filter((connection) => connection.tenant_id === tenantId);
    const tenantTickets = input.tickets.filter((ticket) => ticket.tenant_id === tenantId);
    const tenantInfraCosts = input.infraCosts.filter((entry) => entry.tenant_id === tenantId);
    const currentPeriodRuns = tenantRuns.filter((run) => isWithinWindow(run.finished_at ?? run.started_at, period));
    const activeSchedules = tenantSchedules.filter((schedule) => schedule.status === "active").length;
    const estimatedAiCostUsd = estimateRunsAiCostUsd(currentPeriodRuns);
    const currentPeriodTotalTokens = currentPeriodRuns.reduce(
      (sum, run) => sum + (run.token_usage?.total_tokens ?? 0),
      0
    );

    const providers = Array.from(
      new Set(
        tenantConnections.map((entry) => entry.provider).filter((value): value is string => value.trim().length > 0)
      )
    );
    const latestInfraCost = tenantInfraCosts
      .slice()
      .sort((left, right) => Date.parse(right.period_end) - Date.parse(left.period_end))[0] ?? null;

    const latestRunAt = maxIso(
      tenantRuns.map((run) => run.finished_at ?? run.started_at).filter((value): value is string => typeof value === "string")
    );
    const latestConnectionAt = maxIso(tenantConnections.map((entry) => entry.updated_at));
    const latestTicketAt = maxIso(tenantTickets.map((entry) => entry.last_activity_at));
    const monthlyRunsLimit = account.entitlements.monthly_runs;
    const scheduledReportsLimit = account.entitlements.scheduled_reports;
    const aiBudgetUsd = account.entitlements.ai_budget_usd;

    return {
      tenant_id: tenantId,
      account_name: displayAccountName(account),
      plan_tier: account.plan_tier,
      account_status: account.status,
      billing_status: account.billing_status,
      owner: displayOwnerName(account),
      primary_contact_email: displayPrimaryContactEmail(account),
      seats: account.entitlements.seats,
      monthly_runs_limit: monthlyRunsLimit,
      scheduled_reports_limit: scheduledReportsLimit,
      ai_budget_usd: aiBudgetUsd,
      user_count: tenantUsers.length,
      active_user_count: tenantUsers.filter((user) => user.is_active).length,
      connection_count: tenantConnections.length,
      connection_providers: providers,
      report_contracts: tenantContracts.length,
      report_runs: tenantRuns.length,
      current_period_report_runs: currentPeriodRuns.length,
      remaining_report_credits: monthlyRunsLimit - currentPeriodRuns.length,
      failed_runs: tenantRuns.filter((run) => run.status === "failed").length,
      active_schedules: activeSchedules,
      remaining_schedule_credits: scheduledReportsLimit - activeSchedules,
      total_schedules: tenantSchedules.length,
      current_period_total_tokens: currentPeriodTotalTokens,
      estimated_ai_cost_usd: estimatedAiCostUsd,
      remaining_ai_credits_usd: aiBudgetUsd === null ? null : roundUsd(aiBudgetUsd - estimatedAiCostUsd),
      open_tickets: tenantTickets.filter((ticket) => !isClosedTicket(ticket)).length,
      current_infra_cost_usd: latestInfraCost?.total_cost_usd ?? null,
      last_activity_at: maxIso([
        account.updated_at,
        latestRunAt,
        latestConnectionAt,
        latestTicketAt
      ])
    };
  });
}

function buildConnectionSummaryRows(
  states: Array<{ tenant_id: string; payload: Record<string, unknown>; updated_at: string }>
): ConnectionSummaryRow[] {
  return states.map((entry) => {
    const payload = entry.payload ?? {};
    const allowlistedRelations = Array.isArray(payload.allowed_relations)
      ? payload.allowed_relations.filter((value): value is string => typeof value === "string")
      : [];
    return {
      tenant_id: entry.tenant_id,
      name: typeof payload.name === "string" ? payload.name : "Connected source",
      provider: typeof payload.provider === "string" ? payload.provider : "unknown",
      database: typeof payload.database === "string" ? payload.database : null,
      allowlist_count: allowlistedRelations.length,
      connected_at: typeof payload.connected_at === "string" ? payload.connected_at : null,
      updated_at: entry.updated_at
    };
  });
}

function buildSupportRows(tickets: SupportTicketRecord[], accounts: CustomerAccountRecord[]) {
  const accountNameByTenant = new Map(accounts.map((account) => [account.tenant_id, displayAccountName(account)] as const));
  return tickets
    .map((ticket) => ({
      ...ticket,
      account_name: accountNameByTenant.get(ticket.tenant_id) ?? ticket.tenant_id
    }))
    .sort((left, right) => {
      const statusDelta = Number(isClosedTicket(left)) - Number(isClosedTicket(right));
      if (statusDelta !== 0) {
        return statusDelta;
      }
      const priorityRank = (value: string) => ({ urgent: 4, high: 3, medium: 2, low: 1 }[value] ?? 0);
      const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return Date.parse(right.last_activity_at) - Date.parse(left.last_activity_at);
    });
}

function buildCreditWatchRows(rows: ReturnType<typeof buildAccountSummaryRows>) {
  return rows
    .map((row) => ({
      tenant_id: row.tenant_id,
      account_name: row.account_name,
      plan_tier: row.plan_tier,
      account_status: row.account_status,
      monthly_runs_limit: row.monthly_runs_limit,
      current_period_report_runs: row.current_period_report_runs,
      remaining_report_credits: row.remaining_report_credits,
      scheduled_reports_limit: row.scheduled_reports_limit,
      active_schedules: row.active_schedules,
      remaining_schedule_credits: row.remaining_schedule_credits,
      ai_budget_usd: row.ai_budget_usd,
      estimated_ai_cost_usd: row.estimated_ai_cost_usd,
      remaining_ai_credits_usd: row.remaining_ai_credits_usd,
      current_period_total_tokens: row.current_period_total_tokens,
      current_infra_cost_usd: row.current_infra_cost_usd,
      risk_score: computeAccountRiskScore(row)
    }))
    .sort((left, right) => {
      const riskDelta = right.risk_score - left.risk_score;
      if (riskDelta !== 0) {
        return riskDelta;
      }
      return (right.current_period_report_runs ?? 0) - (left.current_period_report_runs ?? 0);
    });
}

function computeAccountRiskScore(row: ReturnType<typeof buildAccountSummaryRows>[number]): number {
  let score = 0;
  score += row.open_tickets * 3;
  score += row.failed_runs * 2;
  if (row.remaining_report_credits <= 0) {
    score += 4;
  } else if (row.monthly_runs_limit > 0 && row.remaining_report_credits <= Math.max(1, Math.ceil(row.monthly_runs_limit * 0.1))) {
    score += 2;
  }
  if (row.remaining_schedule_credits <= 0) {
    score += 2;
  }
  if (typeof row.remaining_ai_credits_usd === "number" && row.remaining_ai_credits_usd < 0) {
    score += 2;
  }
  if (row.connection_count === 0) {
    score += 1;
  }
  return score;
}

function isClosedTicket(ticket: SupportTicketRecord): boolean {
  return ticket.status === "resolved" || ticket.status === "closed";
}

function isAccountNearLimit(row: ReturnType<typeof buildAccountSummaryRows>[number]): boolean {
  if (row.remaining_report_credits <= 0 || row.remaining_schedule_credits <= 0) {
    return true;
  }
  if (row.monthly_runs_limit > 0 && row.remaining_report_credits <= Math.max(1, Math.ceil(row.monthly_runs_limit * 0.1))) {
    return true;
  }
  if (typeof row.remaining_ai_credits_usd === "number" && row.remaining_ai_credits_usd <= 0) {
    return true;
  }
  return false;
}

function maxIso(values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      continue;
    }
    if (timestamp > bestTime) {
      best = value;
      bestTime = timestamp;
    }
  }
  return best;
}

function isWithinWindow(value: string, window: { start_iso: string; end_iso: string }): boolean {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  return timestamp >= Date.parse(window.start_iso) && timestamp <= Date.parse(window.end_iso);
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function readHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return null;
}

function displayAccountName(account: CustomerAccountRecord): string {
  const name = account.name.trim();
  return name === "Claritect Pilot" ? "Default workspace" : name;
}

function displayOwnerName(account: CustomerAccountRecord): string | null {
  return normalizePlaceholderValue(account.owner, ["Claritect Team"]);
}

function displayPrimaryContactName(account: CustomerAccountRecord): string | null {
  return normalizePlaceholderValue(account.primary_contact_name, ["Claritect Team"]);
}

function displayPrimaryContactEmail(account: CustomerAccountRecord): string | null {
  return normalizePlaceholderValue(account.primary_contact_email, ["owner@example.com"]);
}

function normalizePlaceholderValue(value: string | null, placeholders: string[]): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  return placeholders.some((entry) => entry.toLowerCase() === lower) ? null : trimmed;
}

function computeNextScheduledRunIso(cron: string, timezone: string): string | null {
  try {
    return computeNextRunUtc(cron, timezone, new Date()).toISOString();
  } catch {
    return null;
  }
}

function computeNextRunUtc(cron: string, timezone: string, from: Date): Date {
  new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  const [minuteField, hourField, dayField, monthField, weekDayField] = cron.trim().split(/\s+/);
  const matchers = {
    minute: compileFieldMatcher(minuteField, 0, 59),
    hour: compileFieldMatcher(hourField, 0, 23),
    dayOfMonth: compileFieldMatcher(dayField, 1, 31),
    month: compileFieldMatcher(monthField, 1, 12),
    dayOfWeek: compileFieldMatcher(weekDayField, 0, 6)
  };
  const candidate = new Date(from.getTime());
  candidate.setUTCSeconds(0, 0);
  candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  for (let step = 0; step < 60 * 24 * 366; step += 1) {
    const parts = getZonedParts(candidate, timezone);
    if (
      matchers.minute(parts.minute) &&
      matchers.hour(parts.hour) &&
      matchers.dayOfMonth(parts.dayOfMonth) &&
      matchers.month(parts.month) &&
      matchers.dayOfWeek(parts.dayOfWeek)
    ) {
      return new Date(candidate.getTime());
    }
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
  }
  throw new Error("Unable to compute next run within one year.");
}

function compileFieldMatcher(field: string, min: number, max: number): (value: number) => boolean {
  const values = new Set<number>();
  for (const segment of field.split(",")) {
    const trimmed = segment.trim();
    if (trimmed === "*") {
      for (let value = min; value <= max; value += 1) values.add(value);
      continue;
    }
    if (trimmed.startsWith("*/")) {
      const step = Number.parseInt(trimmed.slice(2), 10);
      if (!Number.isFinite(step) || step <= 0) throw new Error(`Invalid cron segment: ${trimmed}`);
      for (let value = min; value <= max; value += step) values.add(value);
      continue;
    }
    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
        throw new Error(`Invalid cron segment: ${trimmed}`);
      }
      for (let value = start; value <= end; value += 1) {
        if (value >= min && value <= max) values.add(value);
      }
      continue;
    }
    const exact = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(exact) || exact < min || exact > max) {
      throw new Error(`Invalid cron segment: ${trimmed}`);
    }
    values.add(exact);
  }
  return (value: number) => values.has(value);
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((entry) => entry.type === type);
    if (!part) throw new Error(`Missing datetime part: ${type}`);
    return part.value;
  };
  const weekDayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number.parseInt(get("minute"), 10),
    hour: Number.parseInt(get("hour"), 10),
    dayOfMonth: Number.parseInt(get("day"), 10),
    month: Number.parseInt(get("month"), 10),
    dayOfWeek: weekDayMap[get("weekday")]
  };
}
