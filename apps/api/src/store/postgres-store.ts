import { Pool } from "pg";
import type {
  Dimension,
  Metric,
  ReportContract,
  ReportRun,
  SemanticEntity,
  SemanticField,
  SemanticRelationship
} from "@project-overload/shared";
import type { MetadataStore, SemanticCollectionName, SemanticCollections } from "./types";
import { loadInitialMigrationSql } from "../db/sql";

const semanticTableByCollection: Record<SemanticCollectionName, string> = {
  entities: "semantic_entities",
  fields: "semantic_fields",
  relationships: "semantic_relationships",
  metrics: "metrics",
  dimensions: "dimensions"
};

export class PostgresMetadataStore implements MetadataStore {
  constructor(private readonly pool: Pool) {}

  static async create(connectionString: string): Promise<PostgresMetadataStore> {
    const pool = new Pool({ connectionString });
    const store = new PostgresMetadataStore(pool);
    await store.ensureSchema();
    return store;
  }

  async createSemantic<K extends SemanticCollectionName>(
    collection: K,
    payload: SemanticCollections[K]
  ): Promise<SemanticCollections[K]> {
    const table = semanticTableByCollection[collection];
    await this.upsertPayload(table, payload.id, payload);
    return payload;
  }

  async listSemantic<K extends SemanticCollectionName>(collection: K): Promise<SemanticCollections[K][]> {
    const table = semanticTableByCollection[collection];
    return this.listPayloads(table) as Promise<SemanticCollections[K][]>;
  }

  async getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string
  ): Promise<SemanticCollections[K] | null> {
    const table = semanticTableByCollection[collection];
    return this.getPayload(table, id) as Promise<SemanticCollections[K] | null>;
  }

  async createReportContract(payload: ReportContract): Promise<ReportContract> {
    await this.upsertPayload("report_contracts", payload.id, payload);
    return payload;
  }

  async listReportContracts(): Promise<ReportContract[]> {
    return this.listPayloads("report_contracts") as Promise<ReportContract[]>;
  }

  async getReportContract(id: string): Promise<ReportContract | null> {
    return this.getPayload("report_contracts", id) as Promise<ReportContract | null>;
  }

  async createReportRun(payload: ReportRun): Promise<ReportRun> {
    await this.pool.query(
      `
      INSERT INTO report_runs (id, contract_id, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        contract_id = EXCLUDED.contract_id,
        payload = EXCLUDED.payload,
        created_at = NOW()
      `,
      [payload.id, payload.contract_id, JSON.stringify(payload)]
    );

    return payload;
  }

  async listReportRuns(contractId: string): Promise<ReportRun[]> {
    const result = await this.pool.query<{ payload: ReportRun }>(
      `
      SELECT payload
      FROM report_runs
      WHERE contract_id = $1
      ORDER BY created_at ASC
      `,
      [contractId]
    );

    return result.rows.map((row) => row.payload);
  }

  async getLatestReportRun(contractId: string): Promise<ReportRun | null> {
    const result = await this.pool.query<{ payload: ReportRun }>(
      `
      SELECT payload
      FROM report_runs
      WHERE contract_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [contractId]
    );

    return result.rows.length > 0 ? result.rows[0].payload : null;
  }

  async appendAuditLog(eventType: string, payload: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO audit_logs (event_type, payload)
      VALUES ($1, $2::jsonb)
      `,
      [eventType, JSON.stringify(payload)]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async ensureSchema(): Promise<void> {
    const sql = await loadInitialMigrationSql();
    await this.pool.query(sql);
  }

  private async upsertPayload(tableName: string, id: string, payload: unknown): Promise<void> {
    await this.pool.query(
      `
      INSERT INTO ${tableName} (id, payload)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        payload = EXCLUDED.payload,
        created_at = NOW()
      `,
      [id, JSON.stringify(payload)]
    );
  }

  private async listPayloads(
    tableName: string
  ): Promise<
    Array<SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension | ReportContract>
  > {
    const result = await this.pool.query<{ payload: SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension | ReportContract }>(
      `
      SELECT payload
      FROM ${tableName}
      ORDER BY created_at ASC
      `
    );

    return result.rows.map((row) => row.payload);
  }

  private async getPayload(
    tableName: string,
    id: string
  ): Promise<SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension | ReportContract | null> {
    const result = await this.pool.query<{
      payload: SemanticEntity | SemanticField | SemanticRelationship | Metric | Dimension | ReportContract;
    }>(
      `
      SELECT payload
      FROM ${tableName}
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0].payload : null;
  }
}