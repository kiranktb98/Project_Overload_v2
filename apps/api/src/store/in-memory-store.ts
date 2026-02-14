import type {
  ReportContract,
  ReportRun,
  SemanticEntity,
  SemanticField,
  SemanticRelationship,
  Metric,
  Dimension
} from "@project-overload/shared";
import type { MetadataStore, SemanticCollectionName, SemanticCollections } from "./types";

const semanticCollectionNames: SemanticCollectionName[] = [
  "entities",
  "fields",
  "relationships",
  "metrics",
  "dimensions"
];

export class InMemoryMetadataStore implements MetadataStore {
  private readonly semantic = new Map<SemanticCollectionName, Map<string, SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension>>();
  private readonly reportContracts = new Map<string, ReportContract>();
  private readonly reportRuns = new Map<string, ReportRun[]>();
  private readonly reportRunsById = new Map<string, ReportRun>();
  private readonly auditLogs: Array<{ event_type: string; payload: Record<string, unknown> }> = [];

  constructor() {
    for (const name of semanticCollectionNames) {
      this.semantic.set(name, new Map());
    }
  }

  async createSemantic<K extends SemanticCollectionName>(
    collection: K,
    payload: SemanticCollections[K]
  ): Promise<SemanticCollections[K]> {
    this.semantic.get(collection)!.set(payload.id, payload);
    return payload;
  }

  async listSemantic<K extends SemanticCollectionName>(collection: K): Promise<SemanticCollections[K][]> {
    return Array.from(this.semantic.get(collection)!.values()) as SemanticCollections[K][];
  }

  async getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string
  ): Promise<SemanticCollections[K] | null> {
    return (this.semantic.get(collection)!.get(id) as SemanticCollections[K] | undefined) ?? null;
  }

  async createReportContract(payload: ReportContract): Promise<ReportContract> {
    this.reportContracts.set(payload.id, payload);
    return payload;
  }

  async listReportContracts(): Promise<ReportContract[]> {
    return Array.from(this.reportContracts.values());
  }

  async getReportContract(id: string): Promise<ReportContract | null> {
    return this.reportContracts.get(id) ?? null;
  }

  async createReportRun(payload: ReportRun): Promise<ReportRun> {
    const existing = this.reportRuns.get(payload.contract_id) ?? [];
    existing.push(payload);
    this.reportRuns.set(payload.contract_id, existing);
    this.reportRunsById.set(payload.id, payload);
    return payload;
  }

  async listReportRuns(contractId: string): Promise<ReportRun[]> {
    return [...(this.reportRuns.get(contractId) ?? [])];
  }

  async getLatestReportRun(contractId: string): Promise<ReportRun | null> {
    const runs = this.reportRuns.get(contractId) ?? [];
    return runs.length > 0 ? runs[runs.length - 1] : null;
  }

  async getReportRunById(runId: string): Promise<ReportRun | null> {
    return this.reportRunsById.get(runId) ?? null;
  }

  async appendAuditLog(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.auditLogs.push({ event_type: eventType, payload });
  }

  async close(): Promise<void> {
    this.semantic.clear();
    this.reportContracts.clear();
    this.reportRuns.clear();
    this.reportRunsById.clear();
    this.auditLogs.length = 0;
  }
}
