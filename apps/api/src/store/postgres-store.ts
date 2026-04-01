import { Pool } from "pg";
import { randomUUID } from "node:crypto";
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
import type {
  ChatSessionRecord,
  CustomerAccountRecord,
  InfraCostLedgerRecord,
  MetadataStore,
  OpenRouterBalanceHistoryRecord,
  PlatformUserRecord,
  RagChunkSearchResult,
  RagChunkUpsertRecord,
  ReportContractVersionRecord,
  ScheduledReportProfileRecord,
  SemanticCollectionName,
  SemanticCollections,
  SupportTicketRecord,
  SystemStateRecord,
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
const DEMO_USER_ID = "user_test123";
const DEMO_USERNAME = "test123";
const DEMO_PASSWORD_SALT = "99abe147221b66a4b3323aa942e6d2f4";
const DEMO_PASSWORD_HASH =
  "09ba67974ef96ca0ff5d6bde095bf986d9e1030fb5cffff66ee2cbc9c5aae603077464b8f8994b583b2f0f01b0d29b48db23345cc04d6ccf0e413d66b965237d";
const ADMIN_USER_ID = "user_claritect_admin";
const ADMIN_USERNAME = "claritect_admin";

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

  async upsertScheduledReportProfile(
    payload: ScheduledReportProfileRecord,
    context?: StoreRequestContext
  ): Promise<ScheduledReportProfileRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const existing = await this.getScheduledReportProfileByContractId(payload.contract_id, { tenant_id: tenantId });
    const nowIso = new Date().toISOString();
    const normalizedPayload: ScheduledReportProfile = {
      ...payload,
      tenant_id: tenantId,
      created_at: existing?.created_at ?? payload.created_at ?? nowIso,
      updated_at: nowIso
    };

    const result = await this.pool.query<{ payload: ScheduledReportProfile }>(
      `
      INSERT INTO scheduled_report_profiles (id, contract_id, tenant_id, payload)
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (contract_id, tenant_id) DO UPDATE SET
        id = EXCLUDED.id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING payload
      `,
      [normalizedPayload.id, normalizedPayload.contract_id, tenantId, JSON.stringify(normalizedPayload)]
    );

    return result.rows[0].payload;
  }

  async listScheduledReportProfiles(context?: StoreRequestContext): Promise<ScheduledReportProfileRecord[]> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ScheduledReportProfile }>(
      `
      SELECT payload
      FROM scheduled_report_profiles
      WHERE tenant_id = $1
      ORDER BY updated_at DESC, created_at DESC
      `,
      [tenantId]
    );

    return result.rows.map((row) => row.payload);
  }

  async getScheduledReportProfileByContractId(
    contractId: string,
    context?: StoreRequestContext
  ): Promise<ScheduledReportProfileRecord | null> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{ payload: ScheduledReportProfile }>(
      `
      SELECT payload
      FROM scheduled_report_profiles
      WHERE contract_id = $1
        AND tenant_id = $2
      LIMIT 1
      `,
      [contractId, tenantId]
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

  async listSystemStatesByKey(key: string): Promise<SystemStateRecord[]> {
    const result = await this.pool.query<{
      state_key: string;
      tenant_id: string;
      payload: Record<string, unknown>;
      updated_at: string;
    }>(
      `
      SELECT state_key, tenant_id, payload, updated_at::text AS updated_at
      FROM system_state
      WHERE state_key = $1
      ORDER BY updated_at DESC
      `,
      [key]
    );

    return result.rows.map((row) => ({
      state_key: row.state_key,
      tenant_id: row.tenant_id,
      payload: row.payload,
      updated_at: row.updated_at
    }));
  }

  async upsertPlatformUser(
    payload: Omit<PlatformUserRecord, "created_at" | "last_login_at">,
    context?: StoreRequestContext
  ): Promise<PlatformUserRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      username: string;
      password_salt: string;
      password_hash: string;
      role: "customer" | "admin";
      display_name: string | null;
      is_active: boolean;
      created_at: string;
      last_login_at: string | null;
    }>(
      `
      INSERT INTO platform_users (id, tenant_id, username, password_salt, password_hash, role, display_name, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, username) DO UPDATE SET
        id = EXCLUDED.id,
        password_salt = EXCLUDED.password_salt,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        display_name = EXCLUDED.display_name,
        is_active = EXCLUDED.is_active
      RETURNING id, tenant_id, username, password_salt, password_hash, role, display_name, is_active, created_at::text AS created_at, last_login_at::text AS last_login_at
      `,
      [
        payload.id,
        tenantId,
        payload.username,
        payload.password_salt,
        payload.password_hash,
        payload.role,
        payload.display_name,
        payload.is_active
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      username: row.username,
      password_salt: row.password_salt,
      password_hash: row.password_hash,
      role: row.role,
      display_name: row.display_name,
      is_active: row.is_active,
      created_at: row.created_at,
      last_login_at: row.last_login_at
    };
  }

  async getPlatformUserByUsername(username: string, context?: StoreRequestContext): Promise<PlatformUserRecord | null> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      username: string;
      password_salt: string;
      password_hash: string;
      role: "customer" | "admin";
      display_name: string | null;
      is_active: boolean;
      created_at: string;
      last_login_at: string | null;
    }>(
      `
      SELECT id, tenant_id, username, password_salt, password_hash, role, display_name, is_active, created_at::text AS created_at, last_login_at::text AS last_login_at
      FROM platform_users
      WHERE tenant_id = $1
        AND username = $2
      LIMIT 1
      `,
      [tenantId, username]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      username: row.username,
      password_salt: row.password_salt,
      password_hash: row.password_hash,
      role: row.role,
      display_name: row.display_name,
      is_active: row.is_active,
      created_at: row.created_at,
      last_login_at: row.last_login_at
    };
  }

  async listPlatformUsers(context?: StoreRequestContext): Promise<PlatformUserRecord[]> {
    const tenantId = context?.tenant_id?.trim();
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      username: string;
      password_salt: string;
      password_hash: string;
      role: "customer" | "admin";
      display_name: string | null;
      is_active: boolean;
      created_at: string;
      last_login_at: string | null;
    }>(
      tenantId
        ? `
          SELECT id, tenant_id, username, password_salt, password_hash, role, display_name, is_active, created_at::text AS created_at, last_login_at::text AS last_login_at
          FROM platform_users
          WHERE tenant_id = $1
          ORDER BY username ASC
        `
        : `
          SELECT id, tenant_id, username, password_salt, password_hash, role, display_name, is_active, created_at::text AS created_at, last_login_at::text AS last_login_at
          FROM platform_users
          ORDER BY tenant_id ASC, username ASC
        `,
      tenantId ? [tenantId] : []
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      username: row.username,
      password_salt: row.password_salt,
      password_hash: row.password_hash,
      role: row.role,
      display_name: row.display_name,
      is_active: row.is_active,
      created_at: row.created_at,
      last_login_at: row.last_login_at
    }));
  }

  async markPlatformUserLogin(userId: string, context?: StoreRequestContext): Promise<void> {
    const tenantId = resolveTenantId(context);
    await this.pool.query(
      `
      UPDATE platform_users
      SET last_login_at = NOW()
      WHERE id = $1
        AND tenant_id = $2
      `,
      [userId, tenantId]
    );
  }

  async upsertCustomerAccount(
    payload: Omit<CustomerAccountRecord, "created_at" | "updated_at">,
    context?: StoreRequestContext
  ): Promise<CustomerAccountRecord> {
    const tenantId = resolveTenantId(context, payload.tenant_id);
    const result = await this.pool.query<{
      tenant_id: string;
      payload: CustomerAccountRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO customer_accounts (tenant_id, payload)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (tenant_id) DO UPDATE SET
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      `,
      [
        tenantId,
        JSON.stringify({
          ...payload,
          tenant_id: tenantId
        })
      ]
    );

    const row = result.rows[0];
    return {
      ...row.payload,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async listCustomerAccounts(): Promise<CustomerAccountRecord[]> {
    const result = await this.pool.query<{
      tenant_id: string;
      payload: CustomerAccountRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      FROM customer_accounts
      ORDER BY tenant_id ASC
      `
    );

    return result.rows.map((row) => ({
      ...row.payload,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async getCustomerAccountByTenantId(tenantId: string): Promise<CustomerAccountRecord | null> {
    const result = await this.pool.query<{
      tenant_id: string;
      payload: CustomerAccountRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      FROM customer_accounts
      WHERE tenant_id = $1
      LIMIT 1
      `,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return {
      ...row.payload,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async upsertSupportTicket(
    payload: Omit<SupportTicketRecord, "created_at" | "updated_at" | "last_activity_at"> & {
      last_activity_at?: string;
    }
  ): Promise<SupportTicketRecord> {
    const nowIso = new Date().toISOString();
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      payload: SupportTicketRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO support_tickets (id, tenant_id, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING id, tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      `,
      [
        payload.id,
        payload.tenant_id,
        JSON.stringify({
          ...payload,
          last_activity_at: payload.last_activity_at ?? nowIso
        })
      ]
    );

    const row = result.rows[0];
    return {
      ...row.payload,
      id: row.id,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_activity_at: row.payload.last_activity_at ?? row.updated_at
    };
  }

  async listSupportTickets(): Promise<SupportTicketRecord[]> {
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      payload: SupportTicketRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      FROM support_tickets
      ORDER BY updated_at DESC, created_at DESC
      `
    );

    return result.rows.map((row) => ({
      ...row.payload,
      id: row.id,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_activity_at: row.payload.last_activity_at ?? row.updated_at
    }));
  }

  async upsertInfraCostLedger(
    payload: Omit<InfraCostLedgerRecord, "created_at" | "updated_at">
  ): Promise<InfraCostLedgerRecord> {
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      payload: InfraCostLedgerRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO infra_cost_ledger (id, tenant_id, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING id, tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      `,
      [payload.id, payload.tenant_id, JSON.stringify(payload)]
    );

    const row = result.rows[0];
    return {
      ...row.payload,
      id: row.id,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async listInfraCostLedger(): Promise<InfraCostLedgerRecord[]> {
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      payload: InfraCostLedgerRecord;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT id, tenant_id, payload, created_at::text AS created_at, updated_at::text AS updated_at
      FROM infra_cost_ledger
      ORDER BY updated_at DESC, created_at DESC
      `
    );

    return result.rows.map((row) => ({
      ...row.payload,
      id: row.id,
      tenant_id: row.tenant_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async appendOpenRouterBalanceHistory(
    payload: Omit<OpenRouterBalanceHistoryRecord, "id" | "captured_at">
  ): Promise<OpenRouterBalanceHistoryRecord> {
    const recordId = cryptoRandomId();
    const capturedAt = new Date().toISOString();
    const result = await this.pool.query<{
      id: string;
      payload: OpenRouterBalanceHistoryRecord;
      created_at: string;
    }>(
      `
      INSERT INTO openrouter_balance_history (id, payload)
      VALUES ($1, $2::jsonb)
      RETURNING id, payload, created_at::text AS created_at
      `,
      [
        recordId,
        JSON.stringify({
          ...payload,
          captured_at: capturedAt
        })
      ]
    );

    const row = result.rows[0];
    return {
      ...row.payload,
      id: row.id,
      captured_at: row.payload.captured_at ?? row.created_at
    };
  }

  async listOpenRouterBalanceHistory(limit?: number): Promise<OpenRouterBalanceHistoryRecord[]> {
    const result = await this.pool.query<{
      id: string;
      payload: OpenRouterBalanceHistoryRecord;
      created_at: string;
    }>(
      `
      SELECT id, payload, created_at::text AS created_at
      FROM openrouter_balance_history
      ORDER BY created_at DESC
      ${typeof limit === "number" ? `LIMIT ${Math.max(0, Math.trunc(limit))}` : ""}
      `
    );

    return result.rows.map((row) => ({
      ...row.payload,
      id: row.id,
      captured_at: row.payload.captured_at ?? row.created_at
    }));
  }

  async listAllReportContracts(): Promise<ReportContract[]> {
    const result = await this.pool.query<{ payload: ReportContract }>(
      `
      SELECT payload
      FROM report_contracts
      ORDER BY created_at DESC
      `
    );

    return result.rows.map((row) => row.payload);
  }

  async listAllReportRuns(): Promise<ReportRun[]> {
    const result = await this.pool.query<{ payload: ReportRun }>(
      `
      SELECT payload
      FROM report_runs
      ORDER BY created_at DESC
      `
    );

    return result.rows.map((row) => row.payload);
  }

  async listAllScheduledReportProfiles(): Promise<ScheduledReportProfileRecord[]> {
    const result = await this.pool.query<{ payload: ScheduledReportProfileRecord }>(
      `
      SELECT payload
      FROM scheduled_report_profiles
      ORDER BY updated_at DESC, created_at DESC
      `
    );

    return result.rows.map((row) => row.payload);
  }

  async listChatSessions(userId: string, context?: StoreRequestContext): Promise<ChatSessionRecord[]> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      user_id: string;
      title: string;
      title_auto: boolean;
      naming_in_progress: boolean;
      state: Record<string, unknown> | null;
      user_messages: string[];
      db_bootstrapped: boolean;
      messages: ChatSessionRecord["messages"];
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id,
        tenant_id,
        user_id,
        title,
        title_auto,
        naming_in_progress,
        state,
        user_messages,
        db_bootstrapped,
        messages,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM chat_sessions
      WHERE tenant_id = $1
        AND user_id = $2
      ORDER BY updated_at DESC
      `,
      [tenantId, userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      title: row.title,
      title_auto: row.title_auto,
      naming_in_progress: row.naming_in_progress,
      state: row.state,
      user_messages: Array.isArray(row.user_messages) ? row.user_messages : [],
      db_bootstrapped: row.db_bootstrapped,
      messages: Array.isArray(row.messages) ? row.messages : [],
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async upsertChatSession(
    payload: Omit<ChatSessionRecord, "tenant_id" | "created_at" | "updated_at">,
    context?: StoreRequestContext
  ): Promise<ChatSessionRecord> {
    const tenantId = resolveTenantId(context);
    const result = await this.pool.query<{
      id: string;
      tenant_id: string;
      user_id: string;
      title: string;
      title_auto: boolean;
      naming_in_progress: boolean;
      state: Record<string, unknown> | null;
      user_messages: string[];
      db_bootstrapped: boolean;
      messages: ChatSessionRecord["messages"];
      created_at: string;
      updated_at: string;
    }>(
      `
      INSERT INTO chat_sessions (
        id,
        tenant_id,
        user_id,
        title,
        title_auto,
        naming_in_progress,
        state,
        user_messages,
        db_bootstrapped,
        messages
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        title_auto = EXCLUDED.title_auto,
        naming_in_progress = EXCLUDED.naming_in_progress,
        state = EXCLUDED.state,
        user_messages = EXCLUDED.user_messages,
        db_bootstrapped = EXCLUDED.db_bootstrapped,
        messages = EXCLUDED.messages,
        updated_at = CASE
          WHEN
            chat_sessions.tenant_id IS DISTINCT FROM EXCLUDED.tenant_id OR
            chat_sessions.user_id IS DISTINCT FROM EXCLUDED.user_id OR
            chat_sessions.title IS DISTINCT FROM EXCLUDED.title OR
            chat_sessions.title_auto IS DISTINCT FROM EXCLUDED.title_auto OR
            chat_sessions.naming_in_progress IS DISTINCT FROM EXCLUDED.naming_in_progress OR
            chat_sessions.state IS DISTINCT FROM EXCLUDED.state OR
            chat_sessions.user_messages IS DISTINCT FROM EXCLUDED.user_messages OR
            chat_sessions.db_bootstrapped IS DISTINCT FROM EXCLUDED.db_bootstrapped OR
            chat_sessions.messages IS DISTINCT FROM EXCLUDED.messages
          THEN NOW()
          ELSE chat_sessions.updated_at
        END
      RETURNING
        id,
        tenant_id,
        user_id,
        title,
        title_auto,
        naming_in_progress,
        state,
        user_messages,
        db_bootstrapped,
        messages,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      `,
      [
        payload.id,
        tenantId,
        payload.user_id,
        payload.title,
        payload.title_auto,
        payload.naming_in_progress,
        JSON.stringify(payload.state),
        JSON.stringify(payload.user_messages),
        payload.db_bootstrapped,
        JSON.stringify(payload.messages)
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      title: row.title,
      title_auto: row.title_auto,
      naming_in_progress: row.naming_in_progress,
      state: row.state,
      user_messages: Array.isArray(row.user_messages) ? row.user_messages : [],
      db_bootstrapped: row.db_bootstrapped,
      messages: Array.isArray(row.messages) ? row.messages : [],
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async upsertChatRagChunks(payload: RagChunkUpsertRecord[], context?: StoreRequestContext): Promise<void> {
    if (payload.length === 0) {
      return;
    }
    const tenantId = resolveTenantId(context);

    for (const chunk of payload) {
      await this.pool.query(
        `
        INSERT INTO chat_rag_chunks (
          id,
          tenant_id,
          user_id,
          session_id,
          source,
          label,
          text_content,
          content_hash,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
        ON CONFLICT (tenant_id, user_id, session_id, content_hash) DO UPDATE SET
          source = EXCLUDED.source,
          label = EXCLUDED.label,
          text_content = EXCLUDED.text_content,
          embedding = EXCLUDED.embedding,
          updated_at = NOW()
        `,
        [
          cryptoRandomId(),
          tenantId,
          chunk.user_id,
          chunk.session_id,
          chunk.source,
          chunk.label,
          chunk.text_content,
          chunk.content_hash,
          vectorLiteral(chunk.embedding)
        ]
      );
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
    const result = await this.pool.query<{
      source: string;
      label: string;
      text: string;
      similarity: string | number;
    }>(
      `
      SELECT
        source,
        label,
        text_content AS text,
        (1 - (embedding <=> $4::vector)) AS similarity
      FROM chat_rag_chunks
      WHERE tenant_id = $1
        AND user_id = $2
        AND ($3 = '' OR session_id = $3)
      ORDER BY embedding <=> $4::vector ASC
      LIMIT $5
      `,
      [
        tenantId,
        payload.user_id,
        payload.session_id,
        vectorLiteral(payload.embedding),
        Math.max(1, payload.limit)
      ]
    );

    return result.rows.map((row) => ({
      source: row.source,
      label: row.label,
      text: row.text,
      similarity: typeof row.similarity === "number" ? row.similarity : Number(row.similarity)
    }));
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
      DROP TABLE IF EXISTS invoice_ledger;
    `);
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
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_report_profiles (
        id TEXT PRIMARY KEY,
        contract_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (contract_id, tenant_id)
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS scheduled_report_profiles_updated_idx
        ON scheduled_report_profiles(tenant_id, updated_at DESC, created_at DESC);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS platform_users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        username TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        display_name TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ NULL,
        UNIQUE (tenant_id, username)
      );
    `);
    await this.pool.query(`
      ALTER TABLE platform_users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
    `);
    await this.pool.query(`
      ALTER TABLE platform_users
      ADD COLUMN IF NOT EXISTS display_name TEXT NULL;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS customer_accounts (
        tenant_id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS support_tickets_tenant_updated_idx
        ON support_tickets(tenant_id, updated_at DESC, created_at DESC);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS infra_cost_ledger (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS infra_cost_ledger_tenant_updated_idx
        ON infra_cost_ledger(tenant_id, updated_at DESC, created_at DESC);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openrouter_balance_history (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS openrouter_balance_history_created_idx
        ON openrouter_balance_history(created_at DESC);
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        user_id TEXT NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        title_auto BOOLEAN NOT NULL DEFAULT TRUE,
        naming_in_progress BOOLEAN NOT NULL DEFAULT FALSE,
        state JSONB NULL,
        user_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        db_bootstrapped BOOLEAN NOT NULL DEFAULT FALSE,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
        ON chat_sessions(tenant_id, user_id, updated_at DESC);
    `);
    await this.pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_rag_chunks (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT '${DEFAULT_TENANT_ID}',
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL,
        label TEXT NOT NULL,
        text_content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (tenant_id, user_id, session_id, content_hash)
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS chat_rag_chunks_lookup_idx
        ON chat_rag_chunks(tenant_id, user_id, session_id, updated_at DESC);
    `);
    await this.pool.query(
      `
      INSERT INTO platform_users (id, tenant_id, username, password_salt, password_hash, role, display_name, is_active)
      VALUES ($1, $2, $3, $4, $5, 'customer', 'Claritect User', TRUE)
      ON CONFLICT (tenant_id, username) DO UPDATE SET
        role = EXCLUDED.role,
        display_name = EXCLUDED.display_name,
        is_active = TRUE
      `,
      [DEMO_USER_ID, DEFAULT_TENANT_ID, DEMO_USERNAME, DEMO_PASSWORD_SALT, DEMO_PASSWORD_HASH]
    );
    await this.pool.query(
      `
      INSERT INTO platform_users (id, tenant_id, username, password_salt, password_hash, role, display_name, is_active)
      VALUES ($1, $2, $3, $4, $5, 'admin', 'Claritect Admin', TRUE)
      ON CONFLICT (tenant_id, username) DO UPDATE SET
        role = EXCLUDED.role,
        display_name = EXCLUDED.display_name,
        is_active = TRUE
      `,
      [ADMIN_USER_ID, DEFAULT_TENANT_ID, ADMIN_USERNAME, DEMO_PASSWORD_SALT, DEMO_PASSWORD_HASH]
    );
    await this.upsertCustomerAccount(
      {
        tenant_id: DEFAULT_TENANT_ID,
        name: "Claritect Pilot",
        plan_tier: "Growth",
        status: "active",
        primary_contact_name: "Claritect Team",
        primary_contact_email: "owner@example.com",
        billing_status: "current",
        renewal_date: null,
        owner: "Claritect Team",
        notes: "Default seeded customer account.",
        entitlements: {
          seats: 10,
          scheduled_reports: 24,
          monthly_runs: 250,
          ai_budget_usd: null,
          feature_flags: ["marketing_site", "admin_console", "scheduled_reports", "business_case"]
        }
      },
      { tenant_id: DEFAULT_TENANT_ID }
    );
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

function vectorLiteral(values: number[]): string {
  const cleaned = values.map((entry) => (Number.isFinite(entry) ? Number(entry) : 0));
  return `[${cleaned.join(",")}]`;
}

function cryptoRandomId(): string {
  return randomUUID();
}
