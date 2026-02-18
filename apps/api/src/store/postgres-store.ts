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
import type {
  MetadataStore,
  ReportContractVersionRecord,
  SemanticCollectionName,
  SemanticCollections,
  StoreRequestContext
} from "./types";
import { loadInitialMigrationSql } from "../db/sql";

const semanticTableByCollection: Record<SemanticCollectionName, string> = {
  entities: "semantic_entities",
  fields: "semantic_fields",
  relationships: "semantic_relationships",
  metrics: "metrics",
  dimensions: "dimensions"
};

const DEFAULT_TENANT_ID = "default";

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
    payload: SemanticCollections[K],
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K]> {
    void context;
    const table = semanticTableByCollection[collection];
    await this.upsertPayload(table, payload.id, payload);
    return payload;
  }

  async listSemantic<K extends SemanticCollectionName>(
    collection: K,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K][]> {
    void context;
    const table = semanticTableByCollection[collection];
    return this.listPayloads(table) as Promise<SemanticCollections[K][]>;
  }

  async getSemantic<K extends SemanticCollectionName>(
    collection: K,
    id: string,
    context?: StoreRequestContext
  ): Promise<SemanticCollections[K] | null> {
    void context;
    const table = semanticTableByCollection[collection];
    return this.getPayload(table, id) as Promise<SemanticCollections[K] | null>;
  }

  async createReportContract(payload: ReportContract, context?: StoreRequestContext): Promise<ReportContract> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const normalizedPayload: ReportContract = {
      ...payload,
      tenant_id: tenantId
    };
    await this.upsertPayload("report_contracts", normalizedPayload.id, normalizedPayload);
    return normalizedPayload;
  }

  async listReportContracts(context?: StoreRequestContext): Promise<ReportContract[]> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ReportContract }>(
      `
      SELECT payload
      FROM report_contracts
      WHERE COALESCE(payload->>'tenant_id', $1) = $1
      ORDER BY created_at ASC
      `,
      [tenantId]
    );

    return result.rows.map((row) => row.payload);
  }

  async getReportContract(id: string, context?: StoreRequestContext): Promise<ReportContract | null> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ReportContract }>(
      `
      SELECT payload
      FROM report_contracts
      WHERE id = $1
        AND COALESCE(payload->>'tenant_id', $2) = $2
      LIMIT 1
      `,
      [id, tenantId]
    );

    return result.rows.length > 0 ? result.rows[0].payload : null;
  }

  async createReportContractVersion(
    contractId: string,
    payload: ReportContract,
    note: string | null,
    context?: StoreRequestContext
  ): Promise<ReportContractVersionRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const version = payload.contract_version ?? 1;

    const result = await this.pool.query<{
      contract_id: string;
      tenant_id: string;
      version: number;
      payload: ReportContract;
      note: string | null;
      created_at: string;
    }>(
      `
      INSERT INTO report_contract_versions (contract_id, tenant_id, version, payload, note)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (contract_id, tenant_id, version) DO UPDATE SET
        payload = EXCLUDED.payload,
        note = EXCLUDED.note,
        created_at = NOW()
      RETURNING contract_id, tenant_id, version, payload, note, created_at::text AS created_at
      `,
      [contractId, tenantId, version, JSON.stringify({ ...payload, tenant_id: tenantId }), note]
    );

    const row = result.rows[0];
    return {
      contract_id: row.contract_id,
      tenant_id: row.tenant_id,
      version: row.version,
      payload: row.payload,
      note: row.note,
      created_at: row.created_at
    };
  }

  async listReportContractVersions(contractId: string, context?: StoreRequestContext): Promise<ReportContractVersionRecord[]> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{
      contract_id: string;
      tenant_id: string;
      version: number;
      payload: ReportContract;
      note: string | null;
      created_at: string;
    }>(
      `
      SELECT contract_id, tenant_id, version, payload, note, created_at::text AS created_at
      FROM report_contract_versions
      WHERE contract_id = $1
        AND tenant_id = $2
      ORDER BY version ASC
      `,
      [contractId, tenantId]
    );

    return result.rows.map((row) => ({
      contract_id: row.contract_id,
      tenant_id: row.tenant_id,
      version: row.version,
      payload: row.payload,
      note: row.note,
      created_at: row.created_at
    }));
  }

  async createReportRun(payload: ReportRun, context?: StoreRequestContext): Promise<ReportRun> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const normalizedPayload: ReportRun = {
      ...payload,
      tenant_id: tenantId
    };

    await this.pool.query(
      `
      INSERT INTO report_runs (id, contract_id, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        contract_id = EXCLUDED.contract_id,
        payload = EXCLUDED.payload,
        created_at = NOW()
      `,
      [normalizedPayload.id, normalizedPayload.contract_id, JSON.stringify(normalizedPayload)]
    );

    return normalizedPayload;
  }

  async listReportRuns(contractId: string, context?: StoreRequestContext): Promise<ReportRun[]> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ReportRun }>(
      `
      SELECT payload
      FROM report_runs
      WHERE contract_id = $1
        AND COALESCE(payload->>'tenant_id', $2) = $2
      ORDER BY created_at ASC
      `,
      [contractId, tenantId]
    );

    return result.rows.map((row) => row.payload);
  }

  async getLatestReportRun(contractId: string, context?: StoreRequestContext): Promise<ReportRun | null> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ReportRun }>(
      `
      SELECT payload
      FROM report_runs
      WHERE contract_id = $1
        AND COALESCE(payload->>'tenant_id', $2) = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [contractId, tenantId]
    );

    return result.rows.length > 0 ? result.rows[0].payload : null;
  }

  async getReportRunById(runId: string, context?: StoreRequestContext): Promise<ReportRun | null> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ReportRun }>(
      `
      SELECT payload
      FROM report_runs
      WHERE id = $1
        AND COALESCE(payload->>'tenant_id', $2) = $2
      LIMIT 1
      `,
      [runId, tenantId]
    );

    return result.rows.length > 0 ? result.rows[0].payload : null;
  }

  async setSystemState(
    key: string,
    payload: Record<string, unknown> | null,
    context?: StoreRequestContext
  ): Promise<void> {
    const tenantId = resolveTenantId(context);
    if (payload === null) {
      await this.pool.query(
        `
        DELETE FROM system_state
        WHERE state_key = $1
          AND tenant_id = $2
        `,
        [key, tenantId]
      );
      return;
    }

    await this.pool.query(
      `
      INSERT INTO system_state (state_key, tenant_id, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (state_key, tenant_id) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
      `,
      [key, tenantId, JSON.stringify(payload)]
    );
  }

  async getSystemState(key: string, context?: StoreRequestContext): Promise<Record<string, unknown> | null> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: Record<string, unknown> }>(
      `
      SELECT payload
      FROM system_state
      WHERE state_key = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [key, tenantId]
    );

    return result.rows.length > 0 ? result.rows[0].payload : null;
  }

  async appendAuditLog(eventType: string, payload: Record<string, unknown>, context?: StoreRequestContext): Promise<void> {
    const tenantId = resolveTenantId(context);
    await this.pool.query(
      `
      INSERT INTO audit_logs (event_type, payload)
      VALUES ($1, $2::jsonb)
      `,
      [
        eventType,
        JSON.stringify({
          tenant_id: tenantId,
          ...payload
        })
      ]
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async ensureSchema(): Promise<void> {
    const sql = await loadInitialMigrationSql();
    await this.pool.query(sql);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS report_contract_versions (
        id BIGSERIAL PRIMARY KEY,
        contract_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        version INTEGER NOT NULL,
        payload JSONB NOT NULL,
        note TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (contract_id, tenant_id, version)
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS report_contract_versions_contract_tenant_idx
        ON report_contract_versions(contract_id, tenant_id, version DESC);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS system_state (
        state_key TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (state_key, tenant_id)
      );
    `);
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
