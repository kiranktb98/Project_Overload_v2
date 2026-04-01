import type {
  Dimension,
  Metric,
  ReportContract,
  ReportRun,
  ScheduledReportProfile,
  SemanticEntity,
  SemanticField,
  SemanticRelationship
} from "@project-overload/shared";

export type SemanticCollections = {
  entities: SemanticEntity;
  fields: SemanticField;
  relationships: SemanticRelationship;
  metrics: Metric;
  dimensions: Dimension;
};

export type SemanticCollectionName = keyof SemanticCollections;

export type StoreRequestContext = {
  tenant_id: string;
};

export type PlatformUserRole = "customer" | "admin";

export type PlatformUserRecord = {
  id: string;
  tenant_id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  role: PlatformUserRole;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type CustomerAccountRecord = {
  tenant_id: string;
  name: string;
  plan_tier: string;
  status: "active" | "trial" | "paused" | "churned";
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  billing_status: "trialing" | "current" | "past_due" | "canceled";
  renewal_date: string | null;
  owner: string | null;
  notes: string;
  entitlements: {
    seats: number;
    scheduled_reports: number;
    monthly_runs: number;
    ai_budget_usd: number | null;
    feature_flags: string[];
  };
  created_at: string;
  updated_at: string;
};

export type SupportTicketStatus = "open" | "pending" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "medium" | "high" | "urgent";

export type SupportTicketRecord = {
  id: string;
  tenant_id: string;
  title: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: string;
  requester_name: string | null;
  requester_email: string | null;
  assignee: string | null;
  latest_message: string;
  source: "email" | "chat" | "manual" | "system";
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  due_at: string | null;
};

export type InfraCostLedgerRecord = {
  id: string;
  tenant_id: string;
  period_start: string;
  period_end: string;
  api_cost_usd: number;
  worker_cost_usd: number;
  storage_cost_usd: number;
  platform_cost_usd: number;
  total_cost_usd: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type OpenRouterBalanceHistoryRecord = {
  id: string;
  provider: "openrouter";
  remaining_credits: number | null;
  total_credits: number | null;
  used_credits: number | null;
  source: "credits" | "key" | "unavailable";
  stale_reason: string | null;
  captured_at: string;
};

export type SystemStateRecord = {
  state_key: string;
  tenant_id: string;
  payload: Record<string, unknown>;
  updated_at: string;
};

export type ChatSessionMessageRecord = {
  role: "user" | "assistant";
  text: string;
  download_url: string | null;
  exec_brief_html: string | null;
  at: string;
};

export type ChatSessionRecord = {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  title_auto: boolean;
  naming_in_progress: boolean;
  state: Record<string, unknown> | null;
  user_messages: string[];
  db_bootstrapped: boolean;
  messages: ChatSessionMessageRecord[];
  created_at: string;
  updated_at: string;
};

export type ReportContractVersionRecord = {
  contract_id: string;
  tenant_id: string;
  version: number;
  payload: ReportContract;
  note: string | null;
  created_at: string;
};

export type ScheduledReportProfileRecord = ScheduledReportProfile;

export type RagChunkUpsertRecord = {
  user_id: string;
  session_id: string;
  source: string;
  label: string;
  text_content: string;
  content_hash: string;
  embedding: number[];
};

export type RagChunkSearchResult = {
  source: string;
  label: string;
  text: string;
  similarity: number;
};

export interface MetadataStore {
  createSemantic<K extends SemanticCollectionName>(
    collection: K,
    payload: SemanticCollections[K],
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K]>;
  listSemantic<K extends SemanticCollectionName>(
    collection: K,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K][]>;
  getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K] | null>;

  createReportContract(payload: ReportContract, context?: StoreRequestContext): Promise<ReportContract>;
  listReportContracts(context?: StoreRequestContext): Promise<ReportContract[]>;
  getReportContract(id: string, context?: StoreRequestContext): Promise<ReportContract | null>;
  createReportContractVersion(
    contractId: string,
    payload: ReportContract,
    note: string | null,
    context?: StoreRequestContext
  ): Promise<ReportContractVersionRecord>;
  listReportContractVersions(contractId: string, context?: StoreRequestContext): Promise<ReportContractVersionRecord[]>;

  createReportRun(payload: ReportRun, context?: StoreRequestContext): Promise<ReportRun>;
  listReportRuns(contractId: string, context?: StoreRequestContext): Promise<ReportRun[]>;
  getLatestReportRun(contractId: string, context?: StoreRequestContext): Promise<ReportRun | null>;
  getReportRunById(runId: string, context?: StoreRequestContext): Promise<ReportRun | null>;
  upsertScheduledReportProfile(
    payload: ScheduledReportProfileRecord,
    context?: StoreRequestContext
  ): Promise<ScheduledReportProfileRecord>;
  listScheduledReportProfiles(context?: StoreRequestContext): Promise<ScheduledReportProfileRecord[]>;
  getScheduledReportProfileByContractId(
    contractId: string,
    context?: StoreRequestContext
  ): Promise<ScheduledReportProfileRecord | null>;

  setSystemState(key: string, payload: Record<string, unknown> | null, context?: StoreRequestContext): Promise<void>;
  getSystemState(key: string, context?: StoreRequestContext): Promise<Record<string, unknown> | null>;
  listSystemStatesByKey(key: string): Promise<SystemStateRecord[]>;

  upsertPlatformUser(payload: Omit<PlatformUserRecord, "created_at" | "last_login_at">, context?: StoreRequestContext): Promise<PlatformUserRecord>;
  getPlatformUserByUsername(username: string, context?: StoreRequestContext): Promise<PlatformUserRecord | null>;
  listPlatformUsers(context?: StoreRequestContext): Promise<PlatformUserRecord[]>;
  markPlatformUserLogin(userId: string, context?: StoreRequestContext): Promise<void>;

  upsertCustomerAccount(
    payload: Omit<CustomerAccountRecord, "created_at" | "updated_at">,
    context?: StoreRequestContext
  ): Promise<CustomerAccountRecord>;
  listCustomerAccounts(): Promise<CustomerAccountRecord[]>;
  getCustomerAccountByTenantId(tenantId: string): Promise<CustomerAccountRecord | null>;

  upsertSupportTicket(
    payload: Omit<SupportTicketRecord, "created_at" | "updated_at" | "last_activity_at"> & {
      last_activity_at?: string;
    }
  ): Promise<SupportTicketRecord>;
  listSupportTickets(): Promise<SupportTicketRecord[]>;

  upsertInfraCostLedger(
    payload: Omit<InfraCostLedgerRecord, "created_at" | "updated_at">
  ): Promise<InfraCostLedgerRecord>;
  listInfraCostLedger(): Promise<InfraCostLedgerRecord[]>;

  appendOpenRouterBalanceHistory(
    payload: Omit<OpenRouterBalanceHistoryRecord, "id" | "captured_at">
  ): Promise<OpenRouterBalanceHistoryRecord>;
  listOpenRouterBalanceHistory(limit?: number): Promise<OpenRouterBalanceHistoryRecord[]>;

  listAllReportContracts(): Promise<ReportContract[]>;
  listAllReportRuns(): Promise<ReportRun[]>;
  listAllScheduledReportProfiles(): Promise<ScheduledReportProfileRecord[]>;

  listChatSessions(userId: string, context?: StoreRequestContext): Promise<ChatSessionRecord[]>;
  upsertChatSession(
    payload: Omit<ChatSessionRecord, "tenant_id" | "created_at" | "updated_at">,
    context?: StoreRequestContext
  ): Promise<ChatSessionRecord>;
  upsertChatRagChunks(payload: RagChunkUpsertRecord[], context?: StoreRequestContext): Promise<void>;
  searchChatRagChunks(
    payload: {
      user_id: string;
      session_id: string;
      embedding: number[];
      limit: number;
    },
    context?: StoreRequestContext
  ): Promise<RagChunkSearchResult[]>;

  appendAuditLog(eventType: string, payload: Record<string, unknown>, context?: StoreRequestContext): Promise<void>;
  close(): Promise<void>;
}
