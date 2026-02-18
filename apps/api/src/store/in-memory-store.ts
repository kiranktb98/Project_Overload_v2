import type {
  ReportContract,
  ReportRun,
  SemanticEntity,
  SemanticField,
  SemanticRelationship,
  Metric,
  Dimension
} from "@project-overload/shared";
import type {
  MetadataStore,
  ReportContractVersionRecord,
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
  private readonly contractVersionsByTenant = new Map<string, Map<string, ReportContractVersionRecord[]>>();
  private readonly systemStateByTenant = new Map<string, Map<string, Record<string, unknown>>>();
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
    this.contractVersionsByTenant.clear();
    this.systemStateByTenant.clear();
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
