import type {
  Dimension,
  Metric,
  ReportContract,
  ReportRun,
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

export type ReportContractVersionRecord = {
  contract_id: string;
  tenant_id: string;
  version: number;
  payload: ReportContract;
  note: string | null;
  created_at: string;
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

  setSystemState(key: string, payload: Record<string, unknown> | null, context?: StoreRequestContext): Promise<void>;
  getSystemState(key: string, context?: StoreRequestContext): Promise<Record<string, unknown> | null>;

  appendAuditLog(eventType: string, payload: Record<string, unknown>, context?: StoreRequestContext): Promise<void>;
  close(): Promise<void>;
}
