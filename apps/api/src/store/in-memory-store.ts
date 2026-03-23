import type {
  ReportContract,
  ReportRun,
  ScheduledReportProfile,
  SemanticEntity,
  SemanticField,
  SemanticRelationship,
  Metric,
  Dimension
} from "@project-overload/shared";
import type {
  ChatSessionRecord,
  MetadataStore,
  PlatformUserRecord,
  RagChunkSearchResult,
  RagChunkUpsertRecord,
  ReportContractVersionRecord,
  ScheduledReportProfileRecord,
  SemanticCollectionName,
  SemanticCollections,
  StoreRequestContext
} from "./types";

const semanticCollectionNames: SemanticCollectionName[] = [
  "entities",
  "fields",
  "relationships",
  "metrics",
  "dimensions"
];

type SemanticCollectionMap = Map<SemanticCollectionName, Map<string, SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension>>;

const DEFAULT_TENANT_ID = "default";

export class InMemoryMetadataStore implements MetadataStore {
  private readonly semanticByTenant = new Map<string, SemanticCollectionMap>();
  private readonly reportContractsByTenant = new Map<string, Map<string, ReportContract>>();
  private readonly reportRunsByTenant = new Map<string, Map<string, ReportRun[]>>();
  private readonly reportRunsByIdByTenant = new Map<string, Map<string, ReportRun>>();
  private readonly scheduledProfilesByTenant = new Map<string, Map<string, ScheduledReportProfile>>();
  private readonly contractVersionsByTenant = new Map<string, Map<string, ReportContractVersionRecord[]>>();
  private readonly systemStateByTenant = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly usersByTenant = new Map<string, Map<string, PlatformUserRecord>>();
  private readonly chatSessionsByTenant = new Map<string, Map<string, ChatSessionRecord[]>>();
  private readonly ragChunksByTenant = new Map<string, Map<string, RagChunkUpsertRecord[]>>();
  private readonly auditLogs: Array<{ tenant_id: string; event_type: string; payload: Record<string, unknown> }> = [];

  async createSemantic<K extends SemanticCollectionName>(
    collection: K,
    payload: SemanticCollections[K],
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K]> {
    const tenantId = resolveTenantId(context);
    const semantic = this.getOrCreateTenantSemantic(tenantId);
    semantic.get(collection)!.set(payload.id, payload);
    return payload;
  }

  async listSemantic<K extends SemanticCollectionName>(
    collection: K,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K][]> {
    const tenantId = resolveTenantId(context);
    const semantic = this.getOrCreateTenantSemantic(tenantId);
    return Array.from(semantic.get(collection)!.values()) as SemanticCollections[K][];
  }

  async getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K] | null> {
    const tenantId = resolveTenantId(context);
    const semantic = this.getOrCreateTenantSemantic(tenantId);
    return (semantic.get(collection)!.get(id) as SemanticCollections[K] | undefined) ?? null;
  }

  async createReportContract(payload: ReportContract, context?: StoreRequestContext): Promise<ReportContract> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const contracts = this.getOrCreateContracts(tenantId);
    const normalizedPayload: ReportContract = {
      ...payload,
      tenant_id: tenantId
    };
    contracts.set(normalizedPayload.id, normalizedPayload);
    return normalizedPayload;
  }

  async listReportContracts(context?: StoreRequestContext): Promise<ReportContract[]> {
    const tenantId = resolveTenantId(context);
    return Array.from(this.getOrCreateContracts(tenantId).values());
  }

  async getReportContract(id: string, context?: StoreRequestContext): Promise<ReportContract | null> {
    const tenantId = resolveTenantId(context);
    return this.getOrCreateContracts(tenantId).get(id) ?? null;
  }

  async createReportContractVersion(
    contractId: string,
    payload: ReportContract,
    note: string | null,
    context?: StoreRequestContext
  ): Promise<ReportContractVersionRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const byContract = this.getOrCreateVersions(tenantId);
    const versions = byContract.get(contractId) ?? [];
    const record: ReportContractVersionRecord = {
      contract_id: contractId,
      tenant_id: tenantId,
      version: payload.contract_version ?? versions.length + 1,
      payload: {
        ...payload,
        tenant_id: tenantId
      },
      note,
      created_at: new Date().toISOString()
    };
    versions.push(record);
    byContract.set(contractId, versions);
    return record;
  }

  async listReportContractVersions(contractId: string, context?: StoreRequestContext): Promise<ReportContractVersionRecord[]> {
    const tenantId = resolveTenantId(context);
    const byContract = this.getOrCreateVersions(tenantId);
    return [...(byContract.get(contractId) ?? [])];
  }

  async createReportRun(payload: ReportRun, context?: StoreRequestContext): Promise<ReportRun> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const runsByContract = this.getOrCreateRunsByContract(tenantId);
    const existing = (runsByContract.get(payload.contract_id) ?? []).filter((run) => run.id !== payload.id);
    const normalizedPayload: ReportRun = {
      ...payload,
      tenant_id: tenantId
    };
    existing.push(normalizedPayload);
    runsByContract.set(payload.contract_id, existing);

    const runsById = this.getOrCreateRunsById(tenantId);
    runsById.set(payload.id, normalizedPayload);

    return normalizedPayload;
  }

  async listReportRuns(contractId: string, context?: StoreRequestContext): Promise<ReportRun[]> {
    const tenantId = resolveTenantId(context);
    const runs = this.getOrCreateRunsByContract(tenantId).get(contractId) ?? [];
    return [...runs];
  }

  async getLatestReportRun(contractId: string, context?: StoreRequestContext): Promise<ReportRun | null> {
    const tenantId = resolveTenantId(context);
    const runs = this.getOrCreateRunsByContract(tenantId).get(contractId) ?? [];
    return runs.length > 0 ? runs[runs.length - 1] : null;
  }

  async getReportRunById(runId: string, context?: StoreRequestContext): Promise<ReportRun | null> {
    const tenantId = resolveTenantId(context);
    return this.getOrCreateRunsById(tenantId).get(runId) ?? null;
  }

  async upsertScheduledReportProfile(
    payload: ScheduledReportProfileRecord,
    context?: StoreRequestContext
  ): Promise<ScheduledReportProfileRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const profiles = this.getOrCreateScheduledProfiles(tenantId);
    const nowIso = new Date().toISOString();
    const existing = profiles.get(payload.contract_id);
    const normalized: ScheduledReportProfileRecord = {
      ...payload,
      tenant_id: tenantId,
      created_at: existing?.created_at ?? nowIso,
      updated_at: nowIso
    };
    profiles.set(payload.contract_id, normalized);
    return normalized;
  }

  async listScheduledReportProfiles(context?: StoreRequestContext): Promise<ScheduledReportProfileRecord[]> {
    const tenantId = resolveTenantId(context);
    return Array.from(this.getOrCreateScheduledProfiles(tenantId).values()).sort(
      (left, right) => Date.parse(right.updated_at ?? right.created_at ?? "") - Date.parse(left.updated_at ?? left.created_at ?? "")
    );
  }

  async getScheduledReportProfileByContractId(
    contractId: string,
    context?: StoreRequestContext
  ): Promise<ScheduledReportProfileRecord | null> {
    const tenantId = resolveTenantId(context);
    return this.getOrCreateScheduledProfiles(tenantId).get(contractId) ?? null;
  }

  async setSystemState(
    key: string,
    payload: Record<string, unknown> | null,
    context?: StoreRequestContext
  ): Promise<void> {
    const tenantId = resolveTenantId(context);
    const state = this.getOrCreateSystemState(tenantId);
    if (payload === null) {
      state.delete(key);
      return;
    }
    state.set(key, payload);
  }

  async getSystemState(key: string, context?: StoreRequestContext): Promise<Record<string, unknown> | null> {
    const tenantId = resolveTenantId(context);
    const state = this.getOrCreateSystemState(tenantId);
    return state.get(key) ?? null;
  }

  async upsertPlatformUser(
    payload: Omit<PlatformUserRecord, "created_at" | "last_login_at">,
    context?: StoreRequestContext
  ): Promise<PlatformUserRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const users = this.getOrCreateUsers(tenantId);
    const existing = users.get(payload.username);
    const nowIso = new Date().toISOString();
    const user: PlatformUserRecord = {
      ...payload,
      tenant_id: tenantId,
      created_at: existing?.created_at ?? nowIso,
      last_login_at: existing?.last_login_at ?? null
    };
    users.set(payload.username, user);
    return user;
  }

  async getPlatformUserByUsername(username: string, context?: StoreRequestContext): Promise<PlatformUserRecord | null> {
    const tenantId = resolveTenantId(context);
    const users = this.getOrCreateUsers(tenantId);
    return users.get(username) ?? null;
  }

  async markPlatformUserLogin(userId: string, context?: StoreRequestContext): Promise<void> {
    const tenantId = resolveTenantId(context);
    const users = this.getOrCreateUsers(tenantId);
    for (const [username, user] of users) {
      if (user.id === userId) {
        users.set(username, {
          ...user,
          last_login_at: new Date().toISOString()
        });
        return;
      }
    }
  }

  async listChatSessions(userId: string, context?: StoreRequestContext): Promise<ChatSessionRecord[]> {
    const tenantId = resolveTenantId(context);
    const sessions = this.getOrCreateChatSessions(tenantId).get(userId) ?? [];
    return [...sessions].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  }

  async upsertChatSession(
    payload: Omit<ChatSessionRecord, "tenant_id" | "created_at" | "updated_at">,
    context?: StoreRequestContext
  ): Promise<ChatSessionRecord> {
    const tenantId = resolveTenantId(context);
    const byUser = this.getOrCreateChatSessions(tenantId);
    const sessions = byUser.get(payload.user_id) ?? [];
    const existing = sessions.find((entry) => entry.id === payload.id);
    const nowIso = new Date().toISOString();
    const changed =
      !existing ||
      existing.user_id !== payload.user_id ||
      existing.title !== payload.title ||
      existing.title_auto !== payload.title_auto ||
      existing.naming_in_progress !== payload.naming_in_progress ||
      JSON.stringify(existing.state) !== JSON.stringify(payload.state) ||
      JSON.stringify(existing.user_messages) !== JSON.stringify(payload.user_messages) ||
      existing.db_bootstrapped !== payload.db_bootstrapped ||
      JSON.stringify(existing.messages) !== JSON.stringify(payload.messages);
    const session: ChatSessionRecord = {
      ...payload,
      tenant_id: tenantId,
      created_at: existing?.created_at ?? nowIso,
      updated_at: changed ? nowIso : (existing?.updated_at ?? nowIso)
    };
    const next = sessions.filter((entry) => entry.id !== payload.id);
    next.push(session);
    byUser.set(payload.user_id, next);
    return session;
  }

  async upsertChatRagChunks(payload: RagChunkUpsertRecord[], context?: StoreRequestContext): Promise<void> {
    if (payload.length === 0) {
      return;
    }
    const tenantId = resolveTenantId(context);
    const byUser = this.getOrCreateRagChunks(tenantId);

    for (const chunk of payload) {
      const current = byUser.get(chunk.user_id) ?? [];
      const next = current.filter(
        (entry) =>
          !(
            entry.user_id === chunk.user_id &&
            entry.session_id === chunk.session_id &&
            entry.content_hash === chunk.content_hash
          )
      );
      next.push({
        ...chunk,
        session_id: chunk.session_id || ""
      });
      byUser.set(chunk.user_id, next);
    }
  }

  async searchChatRagChunks(
    payload: {
      user_id: string;
      session_id: string;
      embedding: number[];
      limit: number;
    },
    context?: StoreRequestContext
  ): Promise<RagChunkSearchResult[]> {
    const tenantId = resolveTenantId(context);
    const byUser = this.getOrCreateRagChunks(tenantId);
    const source = byUser.get(payload.user_id) ?? [];
    const scoped =
      payload.session_id.trim().length > 0
        ? source.filter((entry) => entry.session_id === payload.session_id)
        : source;

    return scoped
      .map((entry) => ({
        source: entry.source,
        label: entry.label,
        text: entry.text_content,
        similarity: cosineSimilarity(payload.embedding, entry.embedding)
      }))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, Math.max(1, payload.limit));
  }

  async appendAuditLog(eventType: string, payload: Record<string, unknown>, context?: StoreRequestContext): Promise<void> {
    this.auditLogs.push({
      tenant_id: resolveTenantId(context),
      event_type: eventType,
      payload
    });
  }

  async close(): Promise<void> {
    this.semanticByTenant.clear();
    this.reportContractsByTenant.clear();
    this.reportRunsByTenant.clear();
    this.reportRunsByIdByTenant.clear();
    this.scheduledProfilesByTenant.clear();
    this.contractVersionsByTenant.clear();
    this.systemStateByTenant.clear();
    this.usersByTenant.clear();
    this.chatSessionsByTenant.clear();
    this.ragChunksByTenant.clear();
    this.auditLogs.length = 0;
  }

  private getOrCreateTenantSemantic(tenantId: string): SemanticCollectionMap {
    const existing = this.semanticByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const semantic = new Map<SemanticCollectionName, Map<string, SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension>>();
    for (const name of semanticCollectionNames) {
      semantic.set(name, new Map());
    }
    this.semanticByTenant.set(tenantId, semantic);
    return semantic;
  }

  private getOrCreateContracts(tenantId: string): Map<string, ReportContract> {
    const existing = this.reportContractsByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, ReportContract>();
    this.reportContractsByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateRunsByContract(tenantId: string): Map<string, ReportRun[]> {
    const existing = this.reportRunsByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, ReportRun[]>();
    this.reportRunsByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateRunsById(tenantId: string): Map<string, ReportRun> {
    const existing = this.reportRunsByIdByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, ReportRun>();
    this.reportRunsByIdByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateScheduledProfiles(tenantId: string): Map<string, ScheduledReportProfile> {
    const existing = this.scheduledProfilesByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, ScheduledReportProfile>();
    this.scheduledProfilesByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateVersions(tenantId: string): Map<string, ReportContractVersionRecord[]> {
    const existing = this.contractVersionsByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, ReportContractVersionRecord[]>();
    this.contractVersionsByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateSystemState(tenantId: string): Map<string, Record<string, unknown>> {
    const existing = this.systemStateByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, Record<string, unknown>>();
    this.systemStateByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateUsers(tenantId: string): Map<string, PlatformUserRecord> {
    const existing = this.usersByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, PlatformUserRecord>();
    this.usersByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateRagChunks(tenantId: string): Map<string, RagChunkUpsertRecord[]> {
    const existing = this.ragChunksByTenant.get(tenantId);
    if (existing) {
      return existing;
    }
    const created = new Map<string, RagChunkUpsertRecord[]>();
    this.ragChunksByTenant.set(tenantId, created);
    return created;
  }

  private getOrCreateChatSessions(tenantId: string): Map<string, ChatSessionRecord[]> {
    const existing = this.chatSessionsByTenant.get(tenantId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, ChatSessionRecord[]>();
    this.chatSessionsByTenant.set(tenantId, created);
    return created;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    dot += left * right;
    magA += left * left;
    magB += right * right;
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function resolveTenantId(context?: StoreRequestContext, payloadTenantId?: string): string {
  const fromContext = context?.tenant_id?.trim();
  if (fromContext) {
    return fromContext;
  }

  const fromPayload = payloadTenantId?.trim();
  if (fromPayload) {
    return fromPayload;
  }

  return DEFAULT_TENANT_ID;
}
