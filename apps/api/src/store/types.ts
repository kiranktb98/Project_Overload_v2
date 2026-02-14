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

export interface MetadataStore {
  createSemantic<K extends SemanticCollectionName>(
    collection: K,
    payload: SemanticCollections[K]
  ): Promise<SemanticCollections[K]>;
  listSemantic<K extends SemanticCollectionName>(collection: K): Promise<SemanticCollections[K][]>;
  getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string
  ): Promise<SemanticCollections[K] | null>;

  createReportContract(payload: ReportContract): Promise<ReportContract>;
  listReportContracts(): Promise<ReportContract[]>;
  getReportContract(id: string): Promise<ReportContract | null>;

  createReportRun(payload: ReportRun): Promise<ReportRun>;
  listReportRuns(contractId: string): Promise<ReportRun[]>;
  getLatestReportRun(contractId: string): Promise<ReportRun | null>;

  appendAuditLog(eventType: string, payload: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}