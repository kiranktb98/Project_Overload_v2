import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import * as tls from "node:tls";
import { BigQuery, type BigQueryOptions } from "@google-cloud/bigquery";
import mysql, { type Pool as MySqlPool } from "mysql2/promise";
import { Pool, type PoolClient } from "pg";
import snowflakeSdk, {
  type Connection as SnowflakeConnection,
  type ConnectionOptions as SnowflakeConnectionOptions,
  type StatementOption as SnowflakeStatementOption
} from "snowflake-sdk";
import {
  assertAllowlistedRelations,
  assertAllowlistedSchemas,
  assertSelectOnly,
  ensureLimit
} from "@project-overload/sql-guard";
import {
  catalogAgentIndexTable,
  generateBusinessId,
  type LowCardinalityColumn
} from "../agents";
import type { MetadataStore } from "../store";

const EXCLUDED_SCHEMAS = [
  "pg_catalog",
  "information_schema",
  "pg_toast",
  "extensions",
  "auth",
  "storage",
  "supabase_functions",
  "supabase_migrations",
  "graphql",
  "graphql_public",
  "realtime",
  "vault",
  "pgsodium",
  "net",
  "_realtime",
  "_analytics"
];

export type ConnectionProvider = "postgres" | "supabase" | "neon" | "mysql" | "snowflake" | "bigquery";

const POSTGRES_COMPATIBLE_PROVIDERS = new Set<ConnectionProvider>(["postgres", "supabase", "neon"]);
const MYSQL_COMPATIBLE_PROVIDERS = new Set<ConnectionProvider>(["mysql"]);
const SNOWFLAKE_COMPATIBLE_PROVIDERS = new Set<ConnectionProvider>(["snowflake"]);
const BIGQUERY_COMPATIBLE_PROVIDERS = new Set<ConnectionProvider>(["bigquery"]);

export type RelationHealthStatus = "OK" | "NO_SELECT_GRANT" | "RLS_NO_POLICY";

export type RelationHealth = {
  schema_name: string;
  relation_name: string;
  relation_type: "TABLE" | "VIEW" | "MATERIALIZED VIEW";
  qualified_name: string;
  has_select_privilege: boolean;
  has_rls: boolean;
  force_rls: boolean;
  rls_active_for_me: boolean;
  policies_count_for_me: number;
  status: RelationHealthStatus;
  status_label: "OK" | "No SELECT grant" | "RLS active / no policy for this role";
};

export type ConnectionMetadata = {
  current_user: string;
  current_database: string;
  version: string;
};

export type ConnectionTestResult = {
  ok: boolean;
  provider: ConnectionProvider;
  metadata: ConnectionMetadata;
  relations: RelationHealth[];
  recommended_allowlist: string[];
  warnings: string[];
  recommendations: string[];
  permissions_missing: boolean;
  setup_script: string | null;
};

export type ConnectionContext = {
  connected: boolean;
  connection_id: string | null;
  provider: ConnectionProvider | null;
  name: string | null;
  database: string | null;
  connected_at: string | null;
  allowed_relations: string[];
  allowed_schemas: string[];
  available_relations: string[];
  source: "runtime" | "env" | "fallback" | "none";
  read_only_enforced: true;
  select_only_enforced: true;
  catalog: DataCatalog | null;
};

export type QueryResultPayload = {
  rows: Record<string, unknown>[];
  row_count: number;
  governed_sql: string;
  warnings: string[];
  read_only_enforced: true;
  select_only_enforced: true;
};

export type QueryAuditLog = {
  id: string;
  timestamp: string;
  connection_id: string;
  allowlist_snapshot_hash: string;
  row_count: number;
  execution_ms: number;
  governed_sql: string;
  status: "ok" | "error";
  error_message?: string;
};

export type FixScriptInput = {
  allowlisted_relations: string[];
  reader_role?: string;
  reader_password?: string;
  connection_string?: string;
};

export type ConnectInput = {
  connection_string: string;
  provider?: ConnectionProvider;
  tls_ca_pem?: string;
  name?: string;
  allowed_relations?: string[];
  business_context?: string;
};

export type ConnectionManagerOptions = {
  fallback_row_provider?: (sql: string) => Promise<Record<string, unknown>[]> | Record<string, unknown>[];
  fallback_source?: "synthetic" | "postgres";
  default_timeout_ms?: number;
  default_limit?: number;
  app_encryption_key?: string;
  state_store?: Pick<MetadataStore, "setSystemState" | "getSystemState" | "appendAuditLog">;
  tenant_id?: string;
  snowflake_connection_factory?: (options: SnowflakeConnectionOptions) => SnowflakeConnection;
  bigquery_client_factory?: (options: BigQueryOptions) => BigQuery;
};

export type TableColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
};

export type TableCatalogEntry = {
  table_id: string;
  qualified_name: string;
  relation_type: "TABLE" | "VIEW" | "MATERIALIZED VIEW";
  summary: string;
  columns: TableColumnInfo[];
  low_cardinality_columns: LowCardinalityColumn[];
  sample_rows: Record<string, unknown>[];
  row_count_estimate: number;
};

export type DataCatalog = {
  business_id: string;
  tables: TableCatalogEntry[];
  business_context: string;
  cataloged_at: string;
};

export type ColumnValidation = {
  name: string;
  data_type: string;
  accessible: boolean;
  error?: string;
};

export type TableValidation = {
  name: string;
  accessible: boolean;
  error?: string;
  columns: ColumnValidation[];
};

export type AllowlistValidationResult = {
  ok: boolean;
  tables: TableValidation[];
  summary: string;
};

type ActiveConnection = {
  id: string;
  provider: ConnectionProvider;
  business_id: string;
  name: string;
  database: string;
  server_version: string;
  user: string;
  encrypted_connection_string: string;
  encrypted_iv: string;
  encrypted_tag: string;
  pool: Pool | MySqlPool | SnowflakeConnection | BigQuery;
  connected_at: string;
  allowed_relations: string[];
  relations_health: RelationHealth[];
  source: "runtime" | "env";
  catalog: DataCatalog | null;
  query_location: string | null;
};

type LastTestSnapshot = {
  provider: ConnectionProvider;
  tested_at: string;
  metadata: ConnectionMetadata;
  relations: RelationHealth[];
  recommended_allowlist: string[];
  warnings: string[];
  recommendations: string[];
  permissions_missing: boolean;
};

type NormalizedConnection = {
  provider: ConnectionProvider;
  normalized_connection_string: string;
  warnings: string[];
  recommendations: string[];
};

type SnowflakeRuntimeConfig = {
  account: string;
  username: string;
  password: string;
  database: string;
  schema: string;
  warehouse?: string;
  role?: string;
};

type BigQueryRuntimeConfig = {
  project_id: string;
  dataset: string;
  location?: string;
  credentials?: {
    client_email?: string;
    private_key?: string;
    [key: string]: unknown;
  };
  key_filename?: string;
};

const CONNECTION_STATE_KEY = "runtime_connection_v1";
const DEFAULT_TENANT_ID = "default";

export class RuntimeConnectionManager {
  private active: ActiveConnection | null = null;
  private readonly fallbackRowProvider?: ConnectionManagerOptions["fallback_row_provider"];
  private readonly fallbackSource: "synthetic" | "postgres" | null;
  private readonly defaultTimeoutMs: number;
  private readonly defaultLimit: number;
  private readonly encryptionKey: Buffer;
  private readonly snowflakeConnectionFactory: (options: SnowflakeConnectionOptions) => SnowflakeConnection;
  private readonly bigQueryClientFactory: (options: BigQueryOptions) => BigQuery;
  private readonly queryLogs: QueryAuditLog[] = [];
  private lastTest: LastTestSnapshot | null = null;
  private readonly stateStore: Pick<MetadataStore, "setSystemState" | "getSystemState" | "appendAuditLog"> | null;
  private readonly tenantId: string;

  constructor(private readonly options: ConnectionManagerOptions = {}) {
    this.fallbackRowProvider = options.fallback_row_provider;
    this.fallbackSource = options.fallback_source ?? null;
    this.defaultTimeoutMs = options.default_timeout_ms ?? 900000;
    this.defaultLimit = options.default_limit ?? 200;
    this.encryptionKey = deriveEncryptionKey(options.app_encryption_key ?? process.env.APP_ENCRYPTION_KEY);
    this.snowflakeConnectionFactory =
      options.snowflake_connection_factory ?? ((connectionOptions) => snowflakeSdk.createConnection(connectionOptions));
    this.bigQueryClientFactory =
      options.bigquery_client_factory ?? ((clientOptions) => new BigQuery(clientOptions));
    this.stateStore = options.state_store ?? null;
    this.tenantId = options.tenant_id?.trim() || DEFAULT_TENANT_ID;
  }

  async initFromEnv(env: Record<string, string | undefined> = process.env): Promise<void> {
    const restored = await this.restorePersistedConnection();
    if (restored) {
      return;
    }

    const source = (env.DATAPLANE_LOCAL_SOURCE ?? "").trim().toLowerCase();
    const connectionString = env.DATAPLANE_LOCAL_PG_URL ?? env.DATABASE_URL;

    if (source !== "postgres" || !connectionString) {
      return;
    }

    try {
      await this.connect({
        provider: "postgres",
        connection_string: connectionString,
        name: "env-postgres",
        allowed_relations: []
      }, "env");
    } catch {
      // Env bootstrap should never block API startup.
    }
  }

  async testConnection(
    rawConnectionString: string,
    tlsCaPem?: string,
    provider: ConnectionProvider = "postgres"
  ): Promise<ConnectionTestResult> {
    const normalized = normalizeConnectionString(rawConnectionString, provider);
    const parsed = safeParseDbUrl(normalized.normalized_connection_string);

    const warnings = [...normalized.warnings];
    const recommendations = [...normalized.recommendations];

    if (isSnowflakeProvider(normalized.provider)) {
      const config = parseSnowflakeConnectionString(normalized.normalized_connection_string);
      const connection = this.snowflakeConnectionFactory(createSnowflakeConnectionOptions(config));
      try {
        await connectSnowflake(connection);
        const metadata = await readSnowflakeConnectionMetadata(connection, config);
        const relations = await listSnowflakeRelationHealth(connection, config.database);
        const recommendedAllowlist = selectRecommendedAllowlist(relations);
        const permissionsMissing = relations.length === 0;

        const result: ConnectionTestResult = {
          ok: true,
          provider: normalized.provider,
          metadata,
          relations,
          recommended_allowlist: recommendedAllowlist,
          warnings,
          recommendations,
          permissions_missing: permissionsMissing,
          setup_script:
            permissionsMissing || relations.some((entry) => entry.status !== "OK")
              ? this.generateSnowflakeFixScriptInternal({
                  allowlisted_relations:
                    recommendedAllowlist.length > 0
                      ? recommendedAllowlist
                      : relations.map((entry) => entry.qualified_name)
                }, metadata.current_database)
              : null
        };

        this.lastTest = {
          provider: normalized.provider,
          tested_at: new Date().toISOString(),
          metadata,
          relations,
          recommended_allowlist: recommendedAllowlist,
          warnings,
          recommendations,
          permissions_missing: permissionsMissing
        };

        return result;
      } catch (error) {
        throw new Error(formatConnectionError(error, parsed, normalized.provider));
      } finally {
        await closeProviderPool(normalized.provider, connection);
      }
    }

    if (isBigQueryProvider(normalized.provider)) {
      const config = parseBigQueryConnectionString(normalized.normalized_connection_string);
      const client = this.bigQueryClientFactory(createBigQueryClientOptions(config));
      try {
        const metadata = await readBigQueryConnectionMetadata(client, config);
        const relations = await listBigQueryRelationHealth(client, config);
        const recommendedAllowlist = selectRecommendedAllowlist(relations);
        const permissionsMissing = relations.length === 0;

        const result: ConnectionTestResult = {
          ok: true,
          provider: normalized.provider,
          metadata,
          relations,
          recommended_allowlist: recommendedAllowlist,
          warnings,
          recommendations,
          permissions_missing: permissionsMissing,
          setup_script:
            permissionsMissing || relations.some((entry) => entry.status !== "OK")
              ? this.generateBigQueryFixScriptInternal({
                  allowlisted_relations:
                    recommendedAllowlist.length > 0
                      ? recommendedAllowlist
                      : relations.map((entry) => entry.qualified_name)
                }, config)
              : null
        };

        this.lastTest = {
          provider: normalized.provider,
          tested_at: new Date().toISOString(),
          metadata,
          relations,
          recommended_allowlist: recommendedAllowlist,
          warnings,
          recommendations,
          permissions_missing: permissionsMissing
        };

        return result;
      } catch (error) {
        throw new Error(formatConnectionError(error, parsed, normalized.provider));
      } finally {
        await closeProviderPool(normalized.provider, client);
      }
    }

    if (isMySqlProvider(normalized.provider)) {
      const pool = createMySqlPool(normalized.normalized_connection_string, tlsCaPem, 2);
      try {
        await pool.query("select 1 as ok");

        const metadata = await readMySqlConnectionMetadata(pool);
        const relations = await listMySqlRelationHealth(pool, metadata.current_database);
        const recommendedAllowlist = selectRecommendedAllowlist(relations);
        const permissionsMissing = relations.length === 0 || relations.every((entry) => entry.has_select_privilege === false);

        if (permissionsMissing) {
          recommendations.push(
            "Permissions missing for table discovery or SELECT access. Ensure this user has SELECT on the target schema/database."
          );
        }

        const setupScript =
          permissionsMissing || relations.some((entry) => entry.status !== "OK")
            ? this.generateMySqlFixScriptInternal({
                allowlisted_relations:
                  recommendedAllowlist.length > 0
                    ? recommendedAllowlist
                    : relations.map((entry) => entry.qualified_name)
              }, metadata.current_database)
            : null;

        const result: ConnectionTestResult = {
          ok: true,
          provider: normalized.provider,
          metadata,
          relations,
          recommended_allowlist: recommendedAllowlist,
          warnings,
          recommendations,
          permissions_missing: permissionsMissing,
          setup_script: setupScript
        };

        this.lastTest = {
          provider: normalized.provider,
          tested_at: new Date().toISOString(),
          metadata,
          relations,
          recommended_allowlist: recommendedAllowlist,
          warnings,
          recommendations,
          permissions_missing: permissionsMissing
        };

        return result;
      } catch (error) {
        throw new Error(formatConnectionError(error, parsed, normalized.provider));
      } finally {
        await pool.end();
      }
    }

    const ssl = buildPostgresSslOptions(normalized.normalized_connection_string, tlsCaPem);
    const pool = new Pool({
      connectionString: normalized.normalized_connection_string,
      max: 2,
      ssl
    });

    try {
      await pool.query("select 1 as ok");

      const metadata = await readConnectionMetadata(pool);
      const relations = await listRelationHealth(pool);
      const recommendedAllowlist = selectRecommendedAllowlist(relations);
      const permissionsMissing = relations.length === 0 || relations.every((entry) => entry.has_select_privilege === false);

      if (permissionsMissing) {
        recommendations.push("Permissions missing for table discovery or SELECT access. Run generated setup script.");
      }

      const setupScript =
        permissionsMissing || relations.some((entry) => entry.status !== "OK")
          ? this.generateFixScriptInternal({
              allowlisted_relations:
                recommendedAllowlist.length > 0
                  ? recommendedAllowlist
                  : relations.map((entry) => entry.qualified_name)
            }, metadata.current_database, relations)
          : null;

      const result: ConnectionTestResult = {
        ok: true,
        provider: normalized.provider,
        metadata,
        relations,
        recommended_allowlist: recommendedAllowlist,
        warnings,
        recommendations,
        permissions_missing: permissionsMissing,
        setup_script: setupScript
      };

      this.lastTest = {
        provider: normalized.provider,
        tested_at: new Date().toISOString(),
        metadata,
        relations,
        recommended_allowlist: recommendedAllowlist,
        warnings,
        recommendations,
        permissions_missing: permissionsMissing
      };

      return result;
    } catch (error) {
      throw new Error(formatConnectionError(error, parsed, normalized.provider));
    } finally {
      await pool.end();
    }
  }

  async connect(input: ConnectInput, source: "runtime" | "env" = "runtime"): Promise<ConnectionContext> {
    const normalized = normalizeConnectionString(input.connection_string, input.provider);
    const parsed = safeParseDbUrl(normalized.normalized_connection_string);
    const snowflakeConfig = isSnowflakeProvider(normalized.provider)
      ? parseSnowflakeConnectionString(normalized.normalized_connection_string)
      : null;
    const bigQueryConfig = isBigQueryProvider(normalized.provider)
      ? parseBigQueryConnectionString(normalized.normalized_connection_string)
      : null;
    const pool = isMySqlProvider(normalized.provider)
      ? createMySqlPool(normalized.normalized_connection_string, input.tls_ca_pem, 5)
      : isSnowflakeProvider(normalized.provider)
        ? this.snowflakeConnectionFactory(createSnowflakeConnectionOptions(snowflakeConfig as SnowflakeRuntimeConfig))
        : isBigQueryProvider(normalized.provider)
          ? this.bigQueryClientFactory(createBigQueryClientOptions(bigQueryConfig as BigQueryRuntimeConfig))
          : new Pool({
              connectionString: normalized.normalized_connection_string,
              max: 5,
              ssl: buildPostgresSslOptions(normalized.normalized_connection_string, input.tls_ca_pem)
            });

    try {
      if (isMySqlProvider(normalized.provider)) {
        await (pool as MySqlPool).query("select 1 as ok");
      } else if (isSnowflakeProvider(normalized.provider)) {
        await connectSnowflake(pool as SnowflakeConnection);
      } else if (isBigQueryProvider(normalized.provider)) {
        await readBigQueryConnectionMetadata(pool as BigQuery, bigQueryConfig as BigQueryRuntimeConfig);
      } else {
        await (pool as Pool).query("select 1 as ok");
      }
      const metadata = isMySqlProvider(normalized.provider)
        ? await readMySqlConnectionMetadata(pool as MySqlPool)
        : isSnowflakeProvider(normalized.provider)
          ? await readSnowflakeConnectionMetadata(pool as SnowflakeConnection, snowflakeConfig as SnowflakeRuntimeConfig)
          : isBigQueryProvider(normalized.provider)
            ? await readBigQueryConnectionMetadata(pool as BigQuery, bigQueryConfig as BigQueryRuntimeConfig)
            : await readConnectionMetadata(pool as Pool);
      const relations = isMySqlProvider(normalized.provider)
        ? await listMySqlRelationHealth(pool as MySqlPool, metadata.current_database)
        : isSnowflakeProvider(normalized.provider)
          ? await listSnowflakeRelationHealth(pool as SnowflakeConnection, (snowflakeConfig as SnowflakeRuntimeConfig).database)
          : isBigQueryProvider(normalized.provider)
            ? await listBigQueryRelationHealth(pool as BigQuery, bigQueryConfig as BigQueryRuntimeConfig)
            : await listRelationHealth(pool as Pool);
      const availableRelations = relations.map((entry) => entry.qualified_name);
      const recommendedAllowlist = selectRecommendedAllowlist(relations);

      const requestedAllowlist = Array.isArray(input.allowed_relations) && input.allowed_relations.length > 0
        ? input.allowed_relations
        : this.lastTest?.recommended_allowlist.length
          ? this.lastTest.recommended_allowlist
          : recommendedAllowlist.length > 0
            ? recommendedAllowlist
            : availableRelations;

      const allowed = normalizeAllowlist(requestedAllowlist, availableRelations);
      const connectionName = input.name?.trim().length ? input.name.trim() : metadata.current_database;
      const encrypted = encryptConnectionString(normalized.normalized_connection_string, this.encryptionKey);
      const businessId = generateBusinessId();

      const previous = this.active;
      this.active = {
        id: randomUUID(),
        provider: normalized.provider,
        business_id: businessId,
        name: connectionName,
        database: metadata.current_database,
        server_version: metadata.version,
        user: metadata.current_user,
        encrypted_connection_string: encrypted.payload,
        encrypted_iv: encrypted.iv,
        encrypted_tag: encrypted.tag,
        pool: pool as Pool | MySqlPool | SnowflakeConnection | BigQuery,
        connected_at: new Date().toISOString(),
        allowed_relations: allowed,
        relations_health: relations,
        source,
        catalog: null,
        query_location: bigQueryConfig?.location ?? null
      };

      // Auto-catalog: sample rows and column info for allowed tables
      try {
        const catalog = isMySqlProvider(normalized.provider)
          ? await buildDataCatalogMySql(
              pool as MySqlPool,
              businessId,
              allowed,
              relations,
              input.business_context ?? ""
            )
          : isSnowflakeProvider(normalized.provider)
            ? await buildDataCatalogSnowflake(
                pool as SnowflakeConnection,
                businessId,
                allowed,
                relations,
                input.business_context ?? "",
                snowflakeConfig as SnowflakeRuntimeConfig
              )
          : isBigQueryProvider(normalized.provider)
            ? await buildDataCatalogBigQuery(
                pool as BigQuery,
                businessId,
                allowed,
                relations,
                input.business_context ?? "",
                bigQueryConfig as BigQueryRuntimeConfig
              )
          : await buildDataCatalog(
              pool as Pool,
              businessId,
              allowed,
              relations,
              input.business_context ?? ""
            );
        this.active.catalog = catalog;
      } catch {
        // Catalog failure should not block connection
      }

      if (previous) {
        await closeProviderPool(previous.provider, previous.pool);
      }

      await this.persistActiveConnectionState();

      return this.getContext();
    } catch (error) {
      await closeProviderPool(normalized.provider, pool as Pool | MySqlPool | SnowflakeConnection | BigQuery);
      throw new Error(formatConnectionError(error, parsed, normalized.provider));
    }
  }

  async disconnect(): Promise<void> {
    if (!this.active) {
      return;
    }

    await closeProviderPool(this.active.provider, this.active.pool);
    this.active = null;
    await this.persistActiveConnectionState();
  }

  getContext(): ConnectionContext {
    if (this.active) {
      return {
        connected: true,
        connection_id: this.active.id,
        provider: this.active.provider,
        name: this.active.name,
        database: this.active.database,
        connected_at: this.active.connected_at,
        allowed_relations: [...this.active.allowed_relations],
        allowed_schemas: deriveSchemas(this.active.allowed_relations),
        available_relations: this.active.relations_health.map((entry) => entry.qualified_name),
        source: this.active.source,
        read_only_enforced: true,
        select_only_enforced: true,
        catalog: this.active.catalog
      };
    }

    if (this.fallbackRowProvider) {
      return {
        connected: this.fallbackSource === "postgres",
        connection_id: "fallback",
        provider: null,
        name: null,
        database: null,
        connected_at: null,
        allowed_relations: [],
        allowed_schemas: [],
        available_relations: [],
        source: "fallback",
        read_only_enforced: true,
        select_only_enforced: true,
        catalog: null
      };
    }

    return {
      connected: false,
      connection_id: null,
      provider: null,
      name: null,
      database: null,
      connected_at: null,
      allowed_relations: [],
      allowed_schemas: [],
      available_relations: [],
      source: "none",
      read_only_enforced: true,
      select_only_enforced: true,
      catalog: null
    };
  }

  getCatalog(): DataCatalog | null {
    return this.active?.catalog ?? null;
  }

  updateBusinessContext(context: string): void {
    if (!this.active || !this.active.catalog) {
      throw new Error("No active connection with catalog.");
    }
    this.active.catalog.business_context = context;
    void this.persistActiveConnectionState();
  }

  async refreshCatalog(): Promise<DataCatalog | null> {
    if (!this.active) {
      throw new Error("No active database connection.");
    }
    const bigQueryConfig = isBigQueryProvider(this.active.provider)
      ? parseBigQueryConnectionString(
          decryptConnectionString(
            this.active.encrypted_connection_string,
            this.active.encrypted_iv,
            this.active.encrypted_tag,
            this.encryptionKey
          )
        )
      : null;
    const snowflakeConfig = isSnowflakeProvider(this.active.provider)
      ? parseSnowflakeConnectionString(
          decryptConnectionString(
            this.active.encrypted_connection_string,
            this.active.encrypted_iv,
            this.active.encrypted_tag,
            this.encryptionKey
          )
        )
      : null;
    const catalog = isMySqlProvider(this.active.provider)
      ? await buildDataCatalogMySql(
          this.active.pool as MySqlPool,
          this.active.business_id,
          this.active.allowed_relations,
          this.active.relations_health,
          this.active.catalog?.business_context ?? ""
        )
      : isSnowflakeProvider(this.active.provider)
        ? await buildDataCatalogSnowflake(
            this.active.pool as SnowflakeConnection,
            this.active.business_id,
            this.active.allowed_relations,
            this.active.relations_health,
            this.active.catalog?.business_context ?? "",
            snowflakeConfig as SnowflakeRuntimeConfig
          )
      : isBigQueryProvider(this.active.provider)
        ? await buildDataCatalogBigQuery(
            this.active.pool as BigQuery,
            this.active.business_id,
            this.active.allowed_relations,
            this.active.relations_health,
            this.active.catalog?.business_context ?? "",
            bigQueryConfig as BigQueryRuntimeConfig
          )
      : await buildDataCatalog(
          this.active.pool as Pool,
          this.active.business_id,
          this.active.allowed_relations,
          this.active.relations_health,
          this.active.catalog?.business_context ?? ""
        );
    this.active.catalog = catalog;
    await this.persistActiveConnectionState();
    return catalog;
  }

  getTables(): RelationHealth[] {
    if (!this.active) {
      return this.lastTest?.relations ?? [];
    }

    return [...this.active.relations_health];
  }

  getQueryLogs(): QueryAuditLog[] {
    return [...this.queryLogs];
  }

  updateAllowlist(allowedRelations: string[]): ConnectionContext {
    if (!this.active) {
      throw new Error("No active database connection.");
    }

    const available = this.active.relations_health.map((entry) => entry.qualified_name);
    this.active.allowed_relations = normalizeAllowlist(allowedRelations, available);
    void this.persistActiveConnectionState();
    return this.getContext();
  }

  async validateAllowlistAccess(): Promise<AllowlistValidationResult> {
    if (!this.active) {
      throw new Error("No active database connection.");
    }

    if (isMySqlProvider(this.active.provider)) {
      return validateAllowlistAccessMySql(this.active.pool as MySqlPool, this.active.allowed_relations);
    }

    if (isSnowflakeProvider(this.active.provider)) {
      const config = parseSnowflakeConnectionString(
        decryptConnectionString(
          this.active.encrypted_connection_string,
          this.active.encrypted_iv,
          this.active.encrypted_tag,
          this.encryptionKey
        )
      );
      return validateAllowlistAccessSnowflake(
        this.active.pool as SnowflakeConnection,
        this.active.allowed_relations,
        config
      );
    }

    if (isBigQueryProvider(this.active.provider)) {
      const config = parseBigQueryConnectionString(
        decryptConnectionString(
          this.active.encrypted_connection_string,
          this.active.encrypted_iv,
          this.active.encrypted_tag,
          this.encryptionKey
        )
      );
      return validateAllowlistAccessBigQuery(
        this.active.pool as BigQuery,
        this.active.allowed_relations,
        config,
        this.defaultTimeoutMs
      );
    }

    const pool = this.active.pool as Pool;
    const allowed = this.active.allowed_relations;
    const tables: TableValidation[] = [];
    let tablesOk = 0;
    let totalCols = 0;
    let colsOk = 0;

    for (const qualifiedName of allowed) {
      const parts = qualifiedName.split(".");
      if (parts.length !== 2) {
        tables.push({ name: qualifiedName, accessible: false, error: "Invalid qualified name", columns: [] });
        continue;
      }

      const [schema, table] = parts;
      const tableVal: TableValidation = { name: qualifiedName, accessible: false, columns: [] };

      try {
        await pool.query(`SELECT * FROM "${schema}"."${table}" LIMIT 0`);
        tableVal.accessible = true;
        tablesOk++;
      } catch (err) {
        tableVal.error = err instanceof Error ? err.message : "SELECT failed";
        tables.push(tableVal);
        continue;
      }

      try {
        const colResult = await pool.query<{ column_name: string; data_type: string }>(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
          [schema, table]
        );

        for (const col of colResult.rows) {
          totalCols++;
          const colVal: ColumnValidation = { name: col.column_name, data_type: col.data_type, accessible: false };

          try {
            await pool.query(`SELECT "${col.column_name}" FROM "${schema}"."${table}" LIMIT 1`);
            colVal.accessible = true;
            colsOk++;
          } catch (err) {
            colVal.error = err instanceof Error ? err.message : "Column SELECT failed";
          }

          tableVal.columns.push(colVal);
        }
      } catch (err) {
        tableVal.error = `Table accessible but column introspection failed: ${err instanceof Error ? err.message : "unknown"}`;
      }

      tables.push(tableVal);
    }

    const ok = tablesOk === allowed.length && colsOk === totalCols;
    const summary = `${tablesOk}/${allowed.length} tables OK, ${colsOk}/${totalCols} columns accessible`;

    return { ok, tables, summary };
  }

  generateFixScript(input: FixScriptInput): string {
    const provider = this.active?.provider ?? this.lastTest?.provider ?? "postgres";
    if (isMySqlProvider(provider)) {
      const databaseName = this.active?.database ?? this.lastTest?.metadata.current_database ?? "your_database";
      return this.generateMySqlFixScriptInternal(input, databaseName);
    }

    if (isSnowflakeProvider(provider)) {
      const databaseName = this.active?.database ?? this.lastTest?.metadata.current_database ?? "YOUR_DATABASE";
      return this.generateSnowflakeFixScriptInternal(input, databaseName);
    }

    if (isBigQueryProvider(provider)) {
      const config = parseBigQueryConnectionString(
        this.active
          ? decryptConnectionString(
              this.active.encrypted_connection_string,
              this.active.encrypted_iv,
              this.active.encrypted_tag,
              this.encryptionKey
            )
          : this.lastTest?.metadata.current_database?.includes(".")
            ? `bigquery://${this.lastTest.metadata.current_database.replace(".", "/")}`
            : "bigquery://your-project/your_dataset"
      );
      return this.generateBigQueryFixScriptInternal(input, config);
    }

    const metadata = this.active
      ? { current_database: this.active.database }
      : this.lastTest
        ? { current_database: this.lastTest.metadata.current_database }
        : { current_database: "your_database" };

    const relations = this.active?.relations_health ?? this.lastTest?.relations ?? [];
    return this.generateFixScriptInternal(input, metadata.current_database, relations);
  }

  async runSafeQuery(sql: string, requestedLimit?: number): Promise<QueryResultPayload> {
    assertStrictSelectQuery(sql);
    const limit = sanitizeLimit(requestedLimit, this.defaultLimit);
    const governedSql = ensureLimit(sql, limit);

    const started = Date.now();

    if (this.active) {
      const allowedRelations = this.active.allowed_relations;
      const allowedSchemas = deriveSchemas(allowedRelations);

      if (allowedRelations.length === 0) {
        throw new Error("No allowlisted tables configured. Select tables in the connection wizard first.");
      }

      assertAllowlistedRelations(governedSql, allowedRelations);
      assertAllowlistedSchemas(governedSql, allowedSchemas);

      const pgClient =
        isMySqlProvider(this.active.provider) || isSnowflakeProvider(this.active.provider) || isBigQueryProvider(this.active.provider)
          ? null
          : await (this.active.pool as Pool).connect();
      try {
        const rows = isMySqlProvider(this.active.provider)
          ? await executeReadOnlyQueryMySql(this.active.pool as MySqlPool, governedSql, this.defaultTimeoutMs)
          : isSnowflakeProvider(this.active.provider)
            ? await executeReadOnlyQuerySnowflake(
                this.active.pool as SnowflakeConnection,
                governedSql,
                this.defaultTimeoutMs
              )
          : isBigQueryProvider(this.active.provider)
            ? await executeReadOnlyQueryBigQuery(
                this.active.pool as BigQuery,
                governedSql,
                this.defaultTimeoutMs,
                this.active.query_location ?? undefined
              )
          : await executeReadOnlyQuery(pgClient as PoolClient, governedSql, this.defaultTimeoutMs);
        const executionMs = Date.now() - started;
        this.appendQueryLog({
          connection_id: this.active.id,
          allowlist_snapshot_hash: hashAllowlist(allowedRelations),
          row_count: rows.length,
          execution_ms: executionMs,
          governed_sql: governedSql,
          status: "ok"
        });

        return {
          rows,
          row_count: rows.length,
          governed_sql: governedSql,
          warnings: [],
          read_only_enforced: true,
          select_only_enforced: true
        };
      } catch (error) {
        const executionMs = Date.now() - started;
        this.appendQueryLog({
          connection_id: this.active.id,
          allowlist_snapshot_hash: hashAllowlist(allowedRelations),
          row_count: 0,
          execution_ms: executionMs,
          governed_sql: governedSql,
          status: "error",
          error_message: error instanceof Error ? error.message : "unknown error"
        });
        throw error;
      } finally {
        pgClient?.release();
      }
    }

    if (!this.fallbackRowProvider) {
      throw new Error("No active database connection.");
    }

    const rows = await withTimeout(
      Promise.resolve(this.fallbackRowProvider(governedSql)) as Promise<Record<string, unknown>[]>,
      this.defaultTimeoutMs
    );
    const boundedRows = rows.slice(0, limit);
    const executionMs = Date.now() - started;

    this.appendQueryLog({
      connection_id: "fallback",
      allowlist_snapshot_hash: hashAllowlist([]),
      row_count: boundedRows.length,
      execution_ms: executionMs,
      governed_sql: governedSql,
      status: "ok"
    });

    return {
      rows: boundedRows,
      row_count: boundedRows.length,
      governed_sql: governedSql,
      warnings:
        rows.length > limit
          ? ["Running against fallback provider. Rows were truncated to safe limit."]
          : ["Running against fallback provider."],
      read_only_enforced: true,
      select_only_enforced: true
    };
  }

  async rowProvider(sql: string): Promise<Record<string, unknown>[]> {
    if (this.active) {
      if (isMySqlProvider(this.active.provider)) {
        return withTimeout(
          (this.active.pool as MySqlPool)
            .query(sql)
            .then(([rows]) => rows as Record<string, unknown>[]),
          this.defaultTimeoutMs
        );
      }

      if (isSnowflakeProvider(this.active.provider)) {
        return executeReadOnlyQuerySnowflake(this.active.pool as SnowflakeConnection, sql, this.defaultTimeoutMs);
      }

      if (isBigQueryProvider(this.active.provider)) {
        return executeReadOnlyQueryBigQuery(
          this.active.pool as BigQuery,
          sql,
          this.defaultTimeoutMs,
          this.active.query_location ?? undefined
        );
      }

      return withTimeout(
        (this.active.pool as Pool).query(sql).then((result) => result.rows as Record<string, unknown>[]),
        this.defaultTimeoutMs
      );
    }

    if (!this.fallbackRowProvider) {
      return [];
    }

    return withTimeout(
      Promise.resolve(this.fallbackRowProvider(sql)) as Promise<Record<string, unknown>[]>,
      this.defaultTimeoutMs
    );
  }

  async close(): Promise<void> {
    if (this.active) {
      await closeProviderPool(this.active.provider, this.active.pool);
      this.active = null;
    }
  }

  private async restorePersistedConnection(): Promise<boolean> {
    if (!this.stateStore) {
      return false;
    }

    try {
      const state = await this.stateStore.getSystemState(CONNECTION_STATE_KEY, {
        tenant_id: this.tenantId
      });
      if (!state) {
        return false;
      }

      const encryptedPayload = typeof state.encrypted_connection_string === "string"
        ? state.encrypted_connection_string
        : null;
      const encryptedIv = typeof state.encrypted_iv === "string" ? state.encrypted_iv : null;
      const encryptedTag = typeof state.encrypted_tag === "string" ? state.encrypted_tag : null;

      if (!encryptedPayload || !encryptedIv || !encryptedTag) {
        return false;
      }

      const connectionString = decryptConnectionString(
        encryptedPayload,
        encryptedIv,
        encryptedTag,
        this.encryptionKey
      );

      const name = typeof state.name === "string" && state.name.trim().length > 0 ? state.name : "restored";
      const allowedRelations = Array.isArray(state.allowed_relations)
        ? state.allowed_relations.filter((value): value is string => typeof value === "string")
        : [];
      const businessContext = typeof state.business_context === "string" ? state.business_context : "";
      const provider = parseProvider(state.provider);

      await this.connect(
        {
          name,
          provider,
          connection_string: connectionString,
          allowed_relations: allowedRelations,
          business_context: businessContext
        },
        "runtime"
      );

      await this.stateStore.appendAuditLog(
        "connection_state_restored",
        {
          tenant_id: this.tenantId,
          restored_at: new Date().toISOString(),
          name
        },
        { tenant_id: this.tenantId }
      );

      return true;
    } catch {
      return false;
    }
  }

  private async persistActiveConnectionState(): Promise<void> {
    if (!this.stateStore) {
      return;
    }

    if (!this.active) {
      await this.stateStore.setSystemState(CONNECTION_STATE_KEY, null, {
        tenant_id: this.tenantId
      });
      return;
    }

    await this.stateStore.setSystemState(
      CONNECTION_STATE_KEY,
      {
        name: this.active.name,
        provider: this.active.provider,
        database: this.active.database,
        connected_at: this.active.connected_at,
        encrypted_connection_string: this.active.encrypted_connection_string,
        encrypted_iv: this.active.encrypted_iv,
        encrypted_tag: this.active.encrypted_tag,
        allowed_relations: [...this.active.allowed_relations],
        business_context: this.active.catalog?.business_context ?? ""
      },
      { tenant_id: this.tenantId }
    );
  }

  private appendQueryLog(input: Omit<QueryAuditLog, "id" | "timestamp">): void {
    this.queryLogs.push({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input
    });

    if (this.queryLogs.length > 500) {
      this.queryLogs.splice(0, this.queryLogs.length - 500);
    }
  }

  private generateFixScriptInternal(
    input: FixScriptInput,
    databaseName: string,
    relations: RelationHealth[]
  ): string {
    const allowlisted = dedupeLower(input.allowlisted_relations);
    const role = sanitizeRoleName(input.reader_role ?? "overload_reader");
    const password = input.reader_password?.trim().length
      ? input.reader_password.trim()
      : generateReaderPassword();

    const schemas = dedupeLower(allowlisted.map((entry) => entry.split(".")[0]));
    const rlsRelations = relations
      .filter((relation) => relation.has_rls && allowlisted.includes(relation.qualified_name.toLowerCase()))
      .map((relation) => relation.qualified_name.toLowerCase());

    const relationIdentifiers = allowlisted.map((entry) => {
      const [schema, table] = entry.split(".");
      return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    });

    const usageSchemasSql =
      schemas.length > 0
        ? `GRANT USAGE ON SCHEMA ${schemas.map((schema) => quoteIdentifier(schema)).join(", ")} TO ${quoteIdentifier(role)};`
        : "-- No schema selected for usage grant.";

    const grantSelectSql =
      relationIdentifiers.length > 0
        ? `GRANT SELECT ON ${relationIdentifiers.join(", ")} TO ${quoteIdentifier(role)};`
        : "-- No table/view selected for SELECT grant.";

    const defaultPrivilegesSql =
      schemas.length > 0
        ? schemas
            .map(
              (schema) =>
                `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdentifier(schema)} GRANT SELECT ON TABLES TO ${quoteIdentifier(role)};`
            )
            .join("\n")
        : "-- No schema selected for default privileges.";

    const rlsPoliciesSql =
      rlsRelations.length > 0
        ? rlsRelations
            .map((qualified) => {
              const [schema, table] = qualified.split(".");
              const policyName = `po_${role}_${table}_select`;

              return [
                `DO $$`,
                `BEGIN`,
                `  IF NOT EXISTS (`,
                `    SELECT 1`,
                `    FROM pg_policies`,
                `    WHERE schemaname = ${quoteLiteral(schema)}`,
                `      AND tablename = ${quoteLiteral(table)}`,
                `      AND policyname = ${quoteLiteral(policyName)}`,
                `  ) THEN`,
                `    CREATE POLICY ${quoteIdentifier(policyName)}`,
                `      ON ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
                `      FOR SELECT`,
                `      TO ${quoteIdentifier(role)}`,
                `      USING (true);`,
                `  END IF;`,
                `END`,
                `$$;`
              ].join("\n");
            })
            .join("\n\n")
        : "-- No RLS tables selected. No policy statements generated.";

    return [
      "-- Claritect Fix-it Script (MVP)",
      "-- Creates/updates read-only role and grants selected schema/table access.",
      "-- Generated dynamically from current allowlist.",
      "",
      "BEGIN;",
      "",
      `DO $$`,
      `BEGIN`,
      `  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quoteLiteral(role)}) THEN`,
      `    CREATE ROLE ${quoteIdentifier(role)} LOGIN PASSWORD ${quoteLiteral(password)};`,
      `  ELSE`,
      `    ALTER ROLE ${quoteIdentifier(role)} LOGIN PASSWORD ${quoteLiteral(password)};`,
      `  END IF;`,
      `END`,
      `$$;`,
      "",
      `GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${quoteIdentifier(role)};`,
      usageSchemasSql,
      grantSelectSql,
      defaultPrivilegesSql,
      "",
      "-- If RLS is enabled, add permissive SELECT policies for this reader role (MVP mode).",
      rlsPoliciesSql,
      "",
      "COMMIT;",
      "",
      `-- Connection string user should be: ${role}`
    ].join("\n");
  }

  private generateMySqlFixScriptInternal(input: FixScriptInput, databaseName: string): string {
    const allowlisted = dedupeLower(input.allowlisted_relations);
    const role = sanitizeRoleName(input.reader_role ?? "overload_reader");
    const password = input.reader_password?.trim().length
      ? input.reader_password.trim()
      : generateReaderPassword();

    const grants = allowlisted.length > 0
      ? allowlisted.map((entry) => {
          const [schema, table] = entry.includes(".")
            ? entry.split(".", 2)
            : [databaseName, entry];
          return `GRANT SELECT ON ${quoteMySqlIdentifier(schema)}.${quoteMySqlIdentifier(table)} TO ${quoteMySqlLiteral(role)}@'%';`;
        })
      : [`GRANT SELECT ON ${quoteMySqlIdentifier(databaseName)}.* TO ${quoteMySqlLiteral(role)}@'%';`];

    return [
      "-- Claritect Fix-it Script (MySQL, MVP)",
      "-- Creates/updates read-only user and grants SELECT on selected allowlist.",
      "",
      `CREATE USER IF NOT EXISTS ${quoteMySqlLiteral(role)}@'%' IDENTIFIED BY ${quoteMySqlLiteral(password)};`,
      ...grants,
      "FLUSH PRIVILEGES;",
      "",
      `-- Connection string user should be: ${role}`
    ].join("\n");
  }

  private generateSnowflakeFixScriptInternal(input: FixScriptInput, databaseName: string): string {
    const allowlisted = dedupeLower(input.allowlisted_relations);
    const role = sanitizeRoleName(input.reader_role ?? "OVERLOAD_READER").toUpperCase();
    const user = sanitizeRoleName(input.reader_role ?? "overload_reader_user").toUpperCase();
    const password = input.reader_password?.trim().length
      ? input.reader_password.trim()
      : generateReaderPassword();
    const schemas = dedupeLower(
      allowlisted
        .map((entry) => entry.split(".")[0])
        .filter((value): value is string => Boolean(value))
    );

    const schemaUsageSql = schemas.length > 0
      ? schemas
          .map(
            (schema) =>
              `GRANT USAGE ON SCHEMA ${quoteSnowflakePath(databaseName, schema)} TO ROLE ${quoteSnowflakeIdentifier(role)};`
          )
          .join("\n")
      : `-- Grant USAGE on the required schemas in ${databaseName}.`;

    const relationGrantSql = allowlisted.length > 0
      ? allowlisted
          .map((entry) => {
            const [schema, table] = entry.includes(".")
              ? entry.split(".", 2)
              : ["PUBLIC", entry];
            return `GRANT SELECT ON ${quoteSnowflakePath(databaseName, schema, table)} TO ROLE ${quoteSnowflakeIdentifier(role)};`;
          })
          .join("\n")
      : `-- Grant SELECT on the required tables/views in ${databaseName}.`;

    return [
      "-- Claritect Fix-it Script (Snowflake, MVP)",
      "-- Creates a read-only role/user and grants SELECT on the selected allowlist.",
      "",
      `CREATE ROLE IF NOT EXISTS ${quoteSnowflakeIdentifier(role)};`,
      `CREATE USER IF NOT EXISTS ${quoteSnowflakeIdentifier(user)} PASSWORD = ${quoteLiteral(password)} DEFAULT_ROLE = ${quoteLiteral(role)};`,
      `ALTER USER ${quoteSnowflakeIdentifier(user)} SET PASSWORD = ${quoteLiteral(password)};`,
      `GRANT ROLE ${quoteSnowflakeIdentifier(role)} TO USER ${quoteSnowflakeIdentifier(user)};`,
      `GRANT USAGE ON DATABASE ${quoteSnowflakeIdentifier(databaseName)} TO ROLE ${quoteSnowflakeIdentifier(role)};`,
      schemaUsageSql,
      relationGrantSql,
      "",
      `-- Connection string user should be: ${user}`
    ].join("\n");
  }

  private generateBigQueryFixScriptInternal(input: FixScriptInput, config: BigQueryRuntimeConfig): string {
    const principal = (input.reader_role ?? "reader@example.com").trim();
    const datasetRef = `${config.project_id}.${config.dataset}`;
    const allowlisted = dedupeLower(input.allowlisted_relations);
    const tableComments = allowlisted.length > 0
      ? allowlisted.map((entry) => `-- Allowlisted relation: ${entry}`).join("\n")
      : "-- Allowlisted relations will inherit dataset-level viewer access.";

    return [
      "-- Claritect Fix-it Script (BigQuery, MVP)",
      "-- BigQuery access is governed through IAM. Grant read access on the dataset and job execution on the project.",
      tableComments,
      "",
      `GRANT \`roles/bigquery.dataViewer\` ON SCHEMA \`${datasetRef}\` TO ${quoteBigQueryPrincipal(principal)};`,
      `GRANT \`roles/bigquery.jobUser\` ON PROJECT \`${config.project_id}\` TO ${quoteBigQueryPrincipal(principal)};`,
      "",
      `-- Reader principal should be: ${principal}`
    ].join("\n");
  }
}

function normalizeConnectionString(
  rawConnectionString: string,
  providerInput: ConnectionProvider | undefined
): NormalizedConnection {
  const provider = parseProvider(providerInput);
  if (
    !POSTGRES_COMPATIBLE_PROVIDERS.has(provider) &&
    !MYSQL_COMPATIBLE_PROVIDERS.has(provider) &&
    !SNOWFLAKE_COMPATIBLE_PROVIDERS.has(provider) &&
    !BIGQUERY_COMPATIBLE_PROVIDERS.has(provider)
  ) {
    throw new Error(`${formatProviderLabel(provider)} is not supported by the current connection runtime.`);
  }

  const raw = rawConnectionString.trim();
  if (!raw) {
    throw new Error("Connection string is required.");
  }

  let url: URL;
  try {
    const normalizedInput = isMySqlProvider(provider)
      ? raw.startsWith("mysql://")
        ? raw
        : `mysql://${raw}`
      : isSnowflakeProvider(provider)
        ? raw.startsWith("snowflake://")
          ? raw
          : `snowflake://${raw}`
      : isBigQueryProvider(provider)
        ? raw.startsWith("bigquery://")
          ? raw
          : `bigquery://${raw}`
      : raw.startsWith("postgres://") || raw.startsWith("postgresql://")
        ? raw
        : `postgresql://${raw}`;
    url = new URL(normalizedInput);
  } catch {
    throw new Error(`Invalid ${formatProviderLabel(provider)} connection string.`);
  }

  if (isMySqlProvider(provider)) {
    if (url.protocol !== "mysql:") {
      throw new Error("Connection string must use mysql://");
    }
  } else if (isSnowflakeProvider(provider)) {
    if (url.protocol !== "snowflake:") {
      throw new Error("Connection string must use snowflake://");
    }
  } else if (isBigQueryProvider(provider)) {
    if (url.protocol !== "bigquery:") {
      throw new Error("Connection string must use bigquery://");
    }
  } else if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Connection string must use postgres:// or postgresql://");
  }

  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!isBigQueryProvider(provider) && !url.searchParams.get("sslmode")) {
    url.searchParams.set("sslmode", "require");
    warnings.push("sslmode was missing. Added sslmode=require.");
  }

  if (provider === "supabase") {
    recommendations.push(
      "Supabase detected: prefer Connection Pooling -> Transaction mode (host *.pooler.supabase.com) on port 6543."
    );
  }

  if (provider === "neon") {
    recommendations.push("Neon detected: prefer pooled connection strings and keep sslmode=require.");
  }

  if (provider === "mysql") {
    recommendations.push("MySQL detected: use a read-only user and prefer TLS with CA validation.");
  }

  if (provider === "snowflake") {
    recommendations.push("Snowflake detected: include warehouse and schema in the connection string for governed testing and activation.");
  }

  if (provider === "bigquery") {
    recommendations.push("BigQuery detected: include dataset in the connection string path and credentials_json, credentials_base64, or ADC for authentication.");
  }

  if (url.hostname.endsWith(".pooler.supabase.com") && url.port !== "6543") {
    recommendations.push(
      "Supabase detected: prefer transaction pooler mode on port 6543 for this workflow."
    );
  }

  return {
    provider,
    normalized_connection_string: url.toString(),
    warnings,
    recommendations
  };
}

async function readConnectionMetadata(pool: Pool): Promise<ConnectionMetadata> {
  const result = await pool.query<ConnectionMetadata>(
    `
      SELECT
        current_user AS current_user,
        current_database() AS current_database,
        version() AS version
    `
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Unable to read connection metadata.");
  }

  return row;
}

async function listRelationHealth(pool: Pool): Promise<RelationHealth[]> {
  const result = await pool.query<{
    schema_name: string;
    relation_name: string;
    relation_type: "TABLE" | "VIEW" | "MATERIALIZED VIEW";
    has_select_privilege: boolean;
    has_rls: boolean;
    force_rls: boolean;
    rls_active_for_me: boolean;
    policies_count_for_me: number;
  }>(
    `
      SELECT
        n.nspname AS schema_name,
        c.relname AS relation_name,
        CASE c.relkind
          WHEN 'r' THEN 'TABLE'
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
          ELSE 'TABLE'
        END::text AS relation_type,
        has_table_privilege(current_user, c.oid, 'SELECT') AS has_select_privilege,
        c.relrowsecurity AS has_rls,
        c.relforcerowsecurity AS force_rls,
        row_security_active(c.oid) AS rls_active_for_me,
        (
          SELECT count(*)::int
          FROM pg_policies p
          WHERE p.schemaname = n.nspname
            AND p.tablename = c.relname
            AND (
              p.roles = '{}'
              OR current_user = ANY (p.roles)
              OR EXISTS (
                SELECT 1
                FROM unnest(p.roles) AS role_name
                WHERE role_name <> ''
                  AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name)
                  AND pg_has_role(current_user, role_name, 'member')
              )
            )
        ) AS policies_count_for_me
      FROM pg_class c
      INNER JOIN pg_namespace n
        ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'v', 'm')
        AND n.nspname <> ALL($1::text[])
      ORDER BY n.nspname, c.relname
    `,
    [EXCLUDED_SCHEMAS]
  );

  return result.rows.map((row) => {
    const status = classifyRelationStatus(row);
    return {
      ...row,
      qualified_name: `${row.schema_name}.${row.relation_name}`,
      status: status.code,
      status_label: status.label
    };
  });
}

function classifyRelationStatus(relation: {
  has_select_privilege: boolean;
  rls_active_for_me: boolean;
  policies_count_for_me: number;
}): { code: RelationHealthStatus; label: RelationHealth["status_label"] } {
  if (!relation.has_select_privilege) {
    return {
      code: "NO_SELECT_GRANT",
      label: "No SELECT grant"
    };
  }

  if (relation.rls_active_for_me && relation.policies_count_for_me === 0) {
    return {
      code: "RLS_NO_POLICY",
      label: "RLS active / no policy for this role"
    };
  }

  return {
    code: "OK",
    label: "OK"
  };
}

function selectRecommendedAllowlist(relations: RelationHealth[]): string[] {
  // Include both OK and RLS_NO_POLICY tables — RLS tables are still introspectable
  // (information_schema.columns works, sample rows fail gracefully via try/catch)
  const okRelations = relations.filter((entry) => entry.status === "OK" || entry.status === "RLS_NO_POLICY");
  const analyticsOrReportingViews = okRelations.filter(
    (entry) =>
      ["analytics", "reporting"].includes(entry.schema_name.toLowerCase()) &&
      entry.relation_type.includes("VIEW")
  );

  if (analyticsOrReportingViews.length > 0) {
    return analyticsOrReportingViews.map((entry) => entry.qualified_name);
  }

  const allViews = okRelations.filter((entry) => entry.relation_type.includes("VIEW"));
  if (allViews.length > 0) {
    return allViews.map((entry) => entry.qualified_name);
  }

  const publicRelations = okRelations.filter((entry) => entry.schema_name.toLowerCase() === "public");
  if (publicRelations.length > 0) {
    return publicRelations.map((entry) => entry.qualified_name);
  }

  return okRelations.slice(0, 20).map((entry) => entry.qualified_name);
}

async function executeReadOnlyQuery(
  client: PoolClient,
  sql: string,
  timeoutMs: number
): Promise<Record<string, unknown>[]> {
  const boundedTimeoutMs = Math.max(1000, Math.trunc(timeoutMs));
  const idleTimeoutMs = Math.max(boundedTimeoutMs + 5000, 10_000);

  await client.query("BEGIN");

  try {
    await client.query(`SET LOCAL statement_timeout = '${boundedTimeoutMs}ms'`);
    await client.query(`SET LOCAL idle_in_transaction_session_timeout = '${idleTimeoutMs}ms'`);
    await client.query("SET TRANSACTION READ ONLY");

    const result = await client.query(sql);
    await client.query("COMMIT");
    return result.rows as Record<string, unknown>[];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function assertStrictSelectQuery(sql: string): void {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new Error("SQL cannot be empty.");
  }

  if (trimmed.includes(";")) {
    throw new Error("Semicolons are not allowed in safe query mode.");
  }

  if (/--|\/\*/.test(trimmed)) {
    throw new Error("Comments are not allowed in safe query mode.");
  }

  if (/\bcopy\b/i.test(trimmed)) {
    throw new Error("COPY is not allowed in safe query mode.");
  }

  if (/\bselect\b[\s\S]*\binto\b/i.test(trimmed)) {
    throw new Error("SELECT INTO is not allowed in safe query mode.");
  }

  if (/^\s*with\b[\s\S]*\b(insert|update|delete|merge)\b/i.test(trimmed)) {
    throw new Error("WITH statements that modify data are not allowed.");
  }

  assertSelectOnly(trimmed);
}

function sanitizeLimit(limit: number | undefined, defaultLimit: number): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return defaultLimit;
  }

  const rounded = Math.trunc(limit);
  if (rounded <= 0) {
    return defaultLimit;
  }

  return Math.min(rounded, 2000);
}

function normalizeAllowlist(requested: string[] | undefined, available: string[]): string[] {
  const availableSet = new Set(available.map((entry) => entry.toLowerCase()));
  const normalizedRequested = Array.isArray(requested)
    ? requested
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0)
    : [];

  if (normalizedRequested.length === 0) {
    return [...availableSet];
  }

  const allowed = normalizedRequested.filter((entry) => availableSet.has(entry));
  if (allowed.length === 0) {
    throw new Error("None of the provided allowlisted tables/views exist in the connected database.");
  }

  return dedupeLower(allowed);
}

function deriveSchemas(relations: string[]): string[] {
  return dedupeLower(
    relations
      .map((relation) => relation.split(".")[0]?.trim())
      .filter((value): value is string => Boolean(value))
  );
}

function dedupeLower(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0)));
}

function hashAllowlist(allowlist: string[]): string {
  return createHash("sha256").update(JSON.stringify(dedupeLower(allowlist))).digest("hex").slice(0, 20);
}

function deriveEncryptionKey(rawKey: string | undefined): Buffer {
  const seed = rawKey && rawKey.trim().length > 0 ? rawKey.trim() : randomUUID();
  return createHash("sha256").update(seed).digest();
}

function encryptConnectionString(value: string, key: Buffer): { payload: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    payload: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

function decryptConnectionString(payload: string, iv: string, tag: string, key: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

function sanitizeRoleName(raw: string): string {
  const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return normalized.length > 0 ? normalized : "overload_reader";
}

function generateReaderPassword(): string {
  return `ovr_${randomBytes(12).toString("base64url")}`;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteMySqlIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "``")}\``;
}

function quoteMySqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteSnowflakeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function quoteSnowflakePath(database: string, schema: string, table?: string): string {
  return [database, schema, table]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => quoteSnowflakeIdentifier(value))
    .join(".");
}

function quoteBigQueryIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, "\\`")}\``;
}

function quoteBigQueryTable(projectId: string, dataset: string, table: string): string {
  return quoteBigQueryIdentifier(`${projectId}.${dataset}.${table}`);
}

function quoteBigQueryInformationSchema(projectId: string, dataset: string, viewName: string): string {
  return quoteBigQueryIdentifier(`${projectId}.${dataset}.INFORMATION_SCHEMA.${viewName}`);
}

function quoteBigQueryPrincipal(principal: string): string {
  const trimmed = principal.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }
  if (trimmed.includes(":")) {
    return `"${trimmed}"`;
  }
  return `"user:${trimmed}"`;
}

function parseProvider(value: unknown): ConnectionProvider {
  if (typeof value !== "string") {
    return "postgres";
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "postgres" ||
    normalized === "supabase" ||
    normalized === "neon" ||
    normalized === "mysql" ||
    normalized === "snowflake" ||
    normalized === "bigquery"
  ) {
    return normalized;
  }

  return "postgres";
}

function isMySqlProvider(provider: ConnectionProvider): boolean {
  return MYSQL_COMPATIBLE_PROVIDERS.has(provider);
}

function isSnowflakeProvider(provider: ConnectionProvider): boolean {
  return SNOWFLAKE_COMPATIBLE_PROVIDERS.has(provider);
}

function isBigQueryProvider(provider: ConnectionProvider): boolean {
  return BIGQUERY_COMPATIBLE_PROVIDERS.has(provider);
}

function formatProviderLabel(provider: ConnectionProvider): string {
  switch (provider) {
    case "bigquery":
      return "BigQuery";
    case "snowflake":
      return "Snowflake";
    case "mysql":
      return "MySQL";
    case "supabase":
      return "Supabase";
    case "neon":
      return "Neon";
    default:
      return "Postgres";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function safeParseDbUrl(connectionString: string): { host?: string; port?: string; hostname?: string } {
  try {
    const url = new URL(connectionString);
    return {
      host: url.host,
      port: url.port,
      hostname: url.hostname
    };
  } catch {
    return {};
  }
}

function formatConnectionError(
  error: unknown,
  parsed: { host?: string; port?: string; hostname?: string },
  provider: ConnectionProvider = "postgres"
): string {
  const rawHost = parsed.hostname || parsed.host || "unknown-host";
  const formattedHost = rawHost.includes(":") && !rawHost.startsWith("[") ? `[${rawHost}]` : rawHost;
  const port = parsed.port ? `:${parsed.port}` : "";
  const rawMessage = error instanceof Error ? error.message : "Unknown connection error";
  const anyErr = error as { code?: string; syscall?: string; hostname?: string } | null;
  const code = anyErr?.code;

  if (code === "ENOTFOUND" || /ENOTFOUND/i.test(rawMessage)) {
    const maybeSupabaseDirect = Boolean(parsed.hostname && /^db\\./i.test(parsed.hostname) && /\\.supabase\\.co$/i.test(parsed.hostname));
    const supabaseHint = provider === "supabase" && maybeSupabaseDirect
      ? "Supabase direct host detected (db.<ref>.supabase.co). This endpoint is often IPv6-only; on IPv4-only networks it can fail to resolve. Use Supabase Connection Pooling -> Transaction mode (host *.pooler.supabase.com) on port 6543 instead."
      : "Check the hostname spelling and your DNS/VPN/network. Try switching DNS to 1.1.1.1 or 8.8.8.8, or try a different network (phone hotspot).";

    return `DNS lookup failed for ${formattedHost}${port}. ${supabaseHint}`;
  }

  if (code === "ECONNREFUSED") {
    if (provider === "supabase") {
      return `Connection refused by ${formattedHost}${port}. Check host/port, outbound firewall rules, and that the DB is reachable. For Supabase: direct is usually 5432; pooler is 6543.`;
    }
    return `Connection refused by ${formattedHost}${port}. Check host/port, outbound firewall rules, and that ${formatProviderLabel(provider)} is reachable.`;
  }

  if (code === "ETIMEDOUT") {
    return `Timed out connecting to ${formattedHost}${port}. Check network/firewall/VPN restrictions and that the database is reachable.`;
  }

  if (
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    /self-signed certificate/i.test(rawMessage) ||
    /unable to verify/i.test(rawMessage)
  ) {
    const maybeSupabase = provider === "supabase" && (
      Boolean(parsed.hostname && /\\.supabase\\.co$/i.test(parsed.hostname)) ||
      Boolean(parsed.hostname && /\\.pooler\\.supabase\\.com$/i.test(parsed.hostname))
    );
    const supabaseHint = maybeSupabase
      ? "For Supabase, prefer Connection Pooling -> Transaction mode (host *.pooler.supabase.com) on port 6543."
      : "";

    return [
      `TLS certificate validation failed for ${formattedHost}${port}.`,
      "This usually means your network is intercepting TLS (corporate SSL inspection) or the DB uses a self-signed certificate.",
      supabaseHint,
      "Fix options: paste your org/DB CA (PEM) into Advanced TLS in the /connect wizard, or add your org/DB CA to Node via NODE_EXTRA_CA_CERTS and restart the server.",
      "Dev-only workaround: append sslmode=no-verify to the connection string."
    ]
      .filter((chunk) => chunk.length > 0)
      .join(" ");
  }

  if (
    code === "ERR_TLS_CERT_ALTNAME_INVALID" ||
    rawMessage.toLowerCase().includes("hostname/ip does not match certificate")
  ) {
    return `TLS hostname mismatch for ${formattedHost}${port}. Ensure you are connecting via the exact host name issued on the certificate (avoid raw IPs).`;
  }

  if (code === "28P01") {
    return `Authentication failed (28P01). Verify username/password in your ${formatProviderLabel(provider)} connection string.`;
  }

  if (code === "ER_ACCESS_DENIED_ERROR") {
    return `Authentication failed (${code}). Verify username/password in your ${formatProviderLabel(provider)} connection string.`;
  }

  if (code === "3D000") {
    return "Database does not exist (3D000). Verify the database name in your connection string path.";
  }

  if (code === "ER_BAD_DB_ERROR") {
    return "Database does not exist (ER_BAD_DB_ERROR). Verify the database name in your connection string path.";
  }

  return rawMessage;
}

async function closeProviderPool(
  provider: ConnectionProvider,
  pool: Pool | MySqlPool | SnowflakeConnection | BigQuery
): Promise<void> {
  if (isBigQueryProvider(provider)) {
    return;
  }

  if (isSnowflakeProvider(provider)) {
    await new Promise<void>((resolve, reject) => {
      (pool as SnowflakeConnection).destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return;
  }

  if (isMySqlProvider(provider)) {
    await (pool as MySqlPool).end();
    return;
  }
  await (pool as Pool).end();
}

function createMySqlPool(connectionString: string, tlsCaPem?: string, connectionLimit = 5): MySqlPool {
  const poolUri = removeMySqlUnsupportedUriOptions(connectionString);
  return mysql.createPool({
    uri: poolUri,
    waitForConnections: true,
    connectionLimit,
    multipleStatements: false,
    ssl: buildMySqlSslOptions(connectionString, tlsCaPem)
  });
}

function removeMySqlUnsupportedUriOptions(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    // mysql2 doesn't understand `sslmode` URI option and logs noisy warnings.
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

function buildMySqlSslOptions(
  connectionString: string,
  tlsCaPem?: string
): Record<string, unknown> | undefined {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return undefined;
  }

  const extraCaPem = sanitizeTlsCaPem(tlsCaPem);
  const sslmode = (url.searchParams.get("sslmode") ?? "").trim().toLowerCase();

  if (sslmode === "disable") {
    return undefined;
  }

  if (sslmode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  return {
    ca: dedupePem([
      ...safeGetCaCertificates("system"),
      ...safeGetCaCertificates("bundled"),
      ...(extraCaPem ? [extraCaPem] : [])
    ])
  };
}

async function readMySqlConnectionMetadata(pool: MySqlPool): Promise<ConnectionMetadata> {
  const [rowsRaw] = await pool.query(
    `
      SELECT
        CURRENT_USER() AS current_user,
        DATABASE() AS current_database,
        VERSION() AS version
    `
  );

  const rows = toObjectRows(rowsRaw);
  const row = rows[0] ?? {};
  return {
    current_user: String(row.current_user ?? "unknown"),
    current_database: String(row.current_database ?? "unknown"),
    version: String(row.version ?? "unknown")
  };
}

async function listMySqlRelationHealth(pool: MySqlPool, currentDatabase: string): Promise<RelationHealth[]> {
  const [rowsRaw] = await pool.query(
    `
      SELECT
        t.TABLE_SCHEMA AS schema_name,
        t.TABLE_NAME AS relation_name,
        t.TABLE_TYPE AS table_type
      FROM information_schema.TABLES t
      WHERE t.TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    `
  );

  const rows = toObjectRows(rowsRaw);
  const relations = rows.map((row) => {
    const schemaName = String(row.schema_name ?? currentDatabase);
    const relationName = String(row.relation_name ?? "");
    const tableType = String(row.table_type ?? "BASE TABLE").toUpperCase();
    const relationType: RelationHealth["relation_type"] =
      tableType.includes("VIEW") ? "VIEW" : "TABLE";

    const status: { code: RelationHealthStatus; label: RelationHealth["status_label"] } = {
      code: "OK",
      label: "OK"
    };

    return {
      schema_name: schemaName,
      relation_name: relationName,
      relation_type: relationType,
      qualified_name: `${schemaName}.${relationName}`,
      has_select_privilege: true,
      has_rls: false,
      force_rls: false,
      rls_active_for_me: false,
      policies_count_for_me: 0,
      status: status.code,
      status_label: status.label
    };
  });

  return relations.filter((relation) => relation.relation_name.length > 0);
}

async function executeReadOnlyQueryMySql(
  pool: MySqlPool,
  sql: string,
  timeoutMs: number
): Promise<Record<string, unknown>[]> {
  const connection = await pool.getConnection();
  try {
    if (timeoutMs > 0) {
      const bounded = Math.max(1000, Math.trunc(timeoutMs));
      await connection.query(`SET SESSION MAX_EXECUTION_TIME = ${bounded}`);
    }
    await connection.query("START TRANSACTION READ ONLY");
    const [rows] = await connection.query(sql);
    await connection.query("COMMIT");
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows as Record<string, unknown>[];
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch {
      // Ignore rollback errors for failed sessions.
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function validateAllowlistAccessMySql(
  pool: MySqlPool,
  allowed: string[]
): Promise<AllowlistValidationResult> {
  const tables: TableValidation[] = [];
  let tablesOk = 0;
  let totalCols = 0;
  let colsOk = 0;

  for (const qualifiedName of allowed) {
    const parts = qualifiedName.split(".");
    if (parts.length !== 2) {
      tables.push({ name: qualifiedName, accessible: false, error: "Invalid qualified name", columns: [] });
      continue;
    }

    const [schema, table] = parts;
    const tableVal: TableValidation = { name: qualifiedName, accessible: false, columns: [] };

    try {
      await pool.query(`SELECT * FROM ${quoteMySqlIdentifier(schema)}.${quoteMySqlIdentifier(table)} LIMIT 0`);
      tableVal.accessible = true;
      tablesOk++;
    } catch (err) {
      tableVal.error = err instanceof Error ? err.message : "SELECT failed";
      tables.push(tableVal);
      continue;
    }

    try {
      const [columnsRaw] = await pool.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [schema, table]
      );
      const columns = toObjectRows(columnsRaw);

      for (const column of columns) {
        totalCols++;
        const columnName = String(column.column_name ?? "");
        const columnType = String(column.data_type ?? "unknown");
        const colVal: ColumnValidation = { name: columnName, data_type: columnType, accessible: false };

        try {
          await pool.query(
            `SELECT ${quoteMySqlIdentifier(columnName)} FROM ${quoteMySqlIdentifier(schema)}.${quoteMySqlIdentifier(table)} LIMIT 1`
          );
          colVal.accessible = true;
          colsOk++;
        } catch (err) {
          colVal.error = err instanceof Error ? err.message : "Column SELECT failed";
        }

        tableVal.columns.push(colVal);
      }
    } catch (err) {
      tableVal.error = `Table accessible but column introspection failed: ${err instanceof Error ? err.message : "unknown"}`;
    }

    tables.push(tableVal);
  }

  const ok = tablesOk === allowed.length && colsOk === totalCols;
  const summary = `${tablesOk}/${allowed.length} tables OK, ${colsOk}/${totalCols} columns accessible`;
  return { ok, tables, summary };
}

function parseSnowflakeConnectionString(connectionString: string): SnowflakeRuntimeConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid Snowflake connection string.");
  }

  const account = (url.searchParams.get("account") || url.hostname || "").replace(/\.snowflakecomputing\.com$/i, "");
  const pathParts = url.pathname
    .split("/")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const database = pathParts[0] || url.searchParams.get("database") || "";
  const schema = pathParts[1] || url.searchParams.get("schema") || "PUBLIC";
  const username = decodeURIComponent(url.username || "");
  const password = decodeURIComponent(url.password || "");
  const warehouse = url.searchParams.get("warehouse") || undefined;
  const role = url.searchParams.get("role") || undefined;

  if (!account) {
    throw new Error("Snowflake connection string must include an account host.");
  }
  if (!username || !password) {
    throw new Error("Snowflake connection string must include username and password.");
  }
  if (!database) {
    throw new Error("Snowflake connection string must include database in the path.");
  }

  return {
    account,
    username,
    password,
    database,
    schema,
    warehouse,
    role
  };
}

function createSnowflakeConnectionOptions(config: SnowflakeRuntimeConfig): SnowflakeConnectionOptions {
  return {
    account: config.account,
    username: config.username,
    password: config.password,
    database: config.database,
    schema: config.schema,
    warehouse: config.warehouse,
    role: config.role
  };
}

function connectSnowflake(connection: SnowflakeConnection): Promise<void> {
  return new Promise((resolve, reject) => {
    connection.connect((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function executeSnowflakeStatement(
  connection: SnowflakeConnection,
  sqlText: string
): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const options: SnowflakeStatementOption = {
      sqlText,
      complete: (error, _statement, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(normalizeObjectRows(Array.isArray(rows) ? rows : []));
      }
    };
    connection.execute(options);
  });
}

async function executeReadOnlyQuerySnowflake(
  connection: SnowflakeConnection,
  sql: string,
  timeoutMs: number
): Promise<Record<string, unknown>[]> {
  return withTimeout(executeSnowflakeStatement(connection, sql), timeoutMs);
}

async function readSnowflakeConnectionMetadata(
  connection: SnowflakeConnection,
  config: SnowflakeRuntimeConfig
): Promise<ConnectionMetadata> {
  const rows = await executeSnowflakeStatement(
    connection,
    "SELECT CURRENT_USER() AS current_user, CURRENT_DATABASE() AS current_database, CURRENT_VERSION() AS version"
  );
  const row = rows[0] ?? {};
  return {
    current_user: String(row.current_user ?? config.username),
    current_database: String(row.current_database ?? config.database),
    version: String(row.version ?? "Snowflake")
  };
}

async function listSnowflakeRelationHealth(
  connection: SnowflakeConnection,
  database: string
): Promise<RelationHealth[]> {
  const rows = await executeSnowflakeStatement(
    connection,
    [
      "SELECT",
      "  TABLE_SCHEMA AS schema_name,",
      "  TABLE_NAME AS relation_name,",
      "  TABLE_TYPE AS relation_type",
      `FROM ${quoteSnowflakeIdentifier(database)}.INFORMATION_SCHEMA.TABLES`,
      "WHERE TABLE_SCHEMA <> 'INFORMATION_SCHEMA'",
      "ORDER BY TABLE_SCHEMA, TABLE_NAME"
    ].join("\n")
  );

  return rows
    .map((row) => {
      const schemaName = String(row.schema_name ?? "");
      const relationName = String(row.relation_name ?? "");
      const tableType = String(row.relation_type ?? "BASE TABLE").toUpperCase();
      const relationType: RelationHealth["relation_type"] =
        tableType.includes("VIEW") ? (tableType.includes("MATERIALIZED") ? "MATERIALIZED VIEW" : "VIEW") : "TABLE";
      return {
        schema_name: schemaName,
        relation_name: relationName,
        relation_type: relationType,
        qualified_name: `${schemaName}.${relationName}`,
        has_select_privilege: true,
        has_rls: false,
        force_rls: false,
        rls_active_for_me: false,
        policies_count_for_me: 0,
        status: "OK" as const,
        status_label: "OK" as const
      };
    })
    .filter((relation) => relation.schema_name.length > 0 && relation.relation_name.length > 0);
}

async function validateAllowlistAccessSnowflake(
  connection: SnowflakeConnection,
  allowed: string[],
  config: SnowflakeRuntimeConfig
): Promise<AllowlistValidationResult> {
  const tables: TableValidation[] = [];
  let tablesOk = 0;
  let totalCols = 0;
  let colsOk = 0;

  for (const qualifiedName of allowed) {
    const parts = qualifiedName.split(".");
    if (parts.length !== 2) {
      tables.push({ name: qualifiedName, accessible: false, error: "Invalid qualified name", columns: [] });
      continue;
    }

    const [schema, table] = parts;
    const tableVal: TableValidation = { name: qualifiedName, accessible: false, columns: [] };

    try {
      await executeSnowflakeStatement(
        connection,
        `SELECT * FROM ${quoteSnowflakePath(config.database, schema, table)} LIMIT 0`
      );
      tableVal.accessible = true;
      tablesOk++;
    } catch (error) {
      tableVal.error = error instanceof Error ? error.message : "SELECT failed";
      tables.push(tableVal);
      continue;
    }

    try {
      const columns = await executeSnowflakeStatement(
        connection,
        [
          "SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable",
          `FROM ${quoteSnowflakeIdentifier(config.database)}.INFORMATION_SCHEMA.COLUMNS`,
          `WHERE TABLE_SCHEMA = ${quoteLiteral(schema)}`,
          `  AND TABLE_NAME = ${quoteLiteral(table)}`,
          "ORDER BY ORDINAL_POSITION"
        ].join("\n")
      );

      for (const column of columns) {
        totalCols++;
        const columnName = String(column.column_name ?? "");
        const dataType = String(column.data_type ?? "unknown");
        const columnValidation: ColumnValidation = {
          name: columnName,
          data_type: dataType,
          accessible: false
        };

        try {
          await executeSnowflakeStatement(
            connection,
            `SELECT ${quoteSnowflakeIdentifier(columnName)} FROM ${quoteSnowflakePath(config.database, schema, table)} LIMIT 1`
          );
          columnValidation.accessible = true;
          colsOk++;
        } catch (error) {
          columnValidation.error = error instanceof Error ? error.message : "Column SELECT failed";
        }

        tableVal.columns.push(columnValidation);
      }
    } catch (error) {
      tableVal.error = `Table accessible but column introspection failed: ${error instanceof Error ? error.message : "unknown"}`;
    }

    tables.push(tableVal);
  }

  const ok = tablesOk === allowed.length && colsOk === totalCols;
  const summary = `${tablesOk}/${allowed.length} tables OK, ${colsOk}/${totalCols} columns accessible`;
  return { ok, tables, summary };
}

function parseBigQueryConnectionString(connectionString: string): BigQueryRuntimeConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Invalid BigQuery connection string.");
  }

  const projectId = url.hostname.trim() || url.searchParams.get("project_id")?.trim() || "";
  const dataset = url.pathname
    .split("/")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)[0] || url.searchParams.get("dataset")?.trim() || "";
  const location = url.searchParams.get("location")?.trim() || undefined;
  const keyFilename = url.searchParams.get("key_filename")?.trim() || undefined;

  let credentials: BigQueryRuntimeConfig["credentials"] | undefined;
  const credentialsJson = url.searchParams.get("credentials_json");
  const credentialsBase64 = url.searchParams.get("credentials_base64");
  if (credentialsJson) {
    credentials = parseBigQueryCredentials(credentialsJson);
  } else if (credentialsBase64) {
    credentials = parseBigQueryCredentials(Buffer.from(credentialsBase64, "base64").toString("utf8"));
  }

  if (!projectId) {
    throw new Error("BigQuery connection string must include project id in the host.");
  }
  if (!dataset) {
    throw new Error("BigQuery connection string must include dataset in the path.");
  }

  return {
    project_id: projectId,
    dataset,
    location,
    credentials,
    key_filename: keyFilename
  };
}

function parseBigQueryCredentials(raw: string): BigQueryRuntimeConfig["credentials"] {
  try {
    return JSON.parse(raw) as BigQueryRuntimeConfig["credentials"];
  } catch {
    throw new Error("BigQuery credentials_json must be valid JSON.");
  }
}

function createBigQueryClientOptions(config: BigQueryRuntimeConfig): BigQueryOptions {
  return {
    projectId: config.project_id,
    location: config.location,
    credentials: config.credentials,
    keyFilename: config.key_filename
  };
}

async function executeReadOnlyQueryBigQuery(
  client: BigQuery,
  sql: string,
  timeoutMs: number,
  location?: string
): Promise<Record<string, unknown>[]> {
  const [rows] = await withTimeout(
    client.query({
      query: sql,
      location,
      useLegacySql: false,
      jobTimeoutMs: timeoutMs > 0 ? Math.max(1000, Math.trunc(timeoutMs)) : undefined
    }),
    timeoutMs
  );

  return normalizeObjectRows(Array.isArray(rows) ? rows : []);
}

async function readBigQueryConnectionMetadata(
  client: BigQuery,
  config: BigQueryRuntimeConfig
): Promise<ConnectionMetadata> {
  const rows = await executeReadOnlyQueryBigQuery(
    client,
    "SELECT SESSION_USER() AS current_user",
    60_000,
    config.location
  );
  const row = rows[0] ?? {};
  return {
    current_user: String(row.current_user ?? "unknown"),
    current_database: `${config.project_id}.${config.dataset}`,
    version: "BigQuery Standard SQL"
  };
}

async function listBigQueryRelationHealth(
  client: BigQuery,
  config: BigQueryRuntimeConfig
): Promise<RelationHealth[]> {
  const rows = await executeReadOnlyQueryBigQuery(
    client,
    [
      "SELECT",
      "  table_schema AS schema_name,",
      "  table_name AS relation_name,",
      "  table_type AS relation_type",
      `FROM ${quoteBigQueryInformationSchema(config.project_id, config.dataset, "TABLES")}`,
      "ORDER BY table_name"
    ].join("\n"),
    60_000,
    config.location
  );

  return rows
    .map((row) => {
      const schemaName = String(row.schema_name ?? config.dataset);
      const relationName = String(row.relation_name ?? "");
      const tableType = String(row.relation_type ?? "BASE TABLE").toUpperCase();
      const relationType: RelationHealth["relation_type"] =
        tableType.includes("VIEW") ? (tableType.includes("MATERIALIZED") ? "MATERIALIZED VIEW" : "VIEW") : "TABLE";
      return {
        schema_name: schemaName,
        relation_name: relationName,
        relation_type: relationType,
        qualified_name: `${schemaName}.${relationName}`,
        has_select_privilege: true,
        has_rls: false,
        force_rls: false,
        rls_active_for_me: false,
        policies_count_for_me: 0,
        status: "OK" as const,
        status_label: "OK" as const
      };
    })
    .filter((relation) => relation.relation_name.length > 0);
}

async function validateAllowlistAccessBigQuery(
  client: BigQuery,
  allowed: string[],
  config: BigQueryRuntimeConfig,
  timeoutMs: number
): Promise<AllowlistValidationResult> {
  const tables: TableValidation[] = [];
  let tablesOk = 0;
  let totalCols = 0;
  let colsOk = 0;

  for (const qualifiedName of allowed) {
    const parts = qualifiedName.split(".");
    if (parts.length !== 2) {
      tables.push({ name: qualifiedName, accessible: false, error: "Invalid qualified name", columns: [] });
      continue;
    }

    const [dataset, table] = parts;
    const tableVal: TableValidation = { name: qualifiedName, accessible: false, columns: [] };

    try {
      await executeReadOnlyQueryBigQuery(
        client,
        `SELECT * FROM ${quoteBigQueryTable(config.project_id, dataset, table)} LIMIT 0`,
        timeoutMs,
        config.location
      );
      tableVal.accessible = true;
      tablesOk++;
    } catch (error) {
      tableVal.error = error instanceof Error ? error.message : "SELECT failed";
      tables.push(tableVal);
      continue;
    }

    try {
      const columns = await executeReadOnlyQueryBigQuery(
        client,
        [
          "SELECT column_name, data_type, is_nullable",
          `FROM ${quoteBigQueryInformationSchema(config.project_id, dataset, "COLUMNS")}`,
          `WHERE table_name = ${quoteLiteral(table)}`,
          "ORDER BY ordinal_position"
        ].join("\n"),
        timeoutMs,
        config.location
      );

      for (const column of columns) {
        totalCols++;
        const columnName = String(column.column_name ?? "");
        const dataType = String(column.data_type ?? "unknown");
        const columnValidation: ColumnValidation = {
          name: columnName,
          data_type: dataType,
          accessible: false
        };

        try {
          await executeReadOnlyQueryBigQuery(
            client,
            `SELECT ${quoteBigQueryIdentifier(columnName)} FROM ${quoteBigQueryTable(config.project_id, dataset, table)} LIMIT 1`,
            timeoutMs,
            config.location
          );
          columnValidation.accessible = true;
          colsOk++;
        } catch (error) {
          columnValidation.error = error instanceof Error ? error.message : "Column SELECT failed";
        }

        tableVal.columns.push(columnValidation);
      }
    } catch (error) {
      tableVal.error = `Table accessible but column introspection failed: ${error instanceof Error ? error.message : "unknown"}`;
    }

    tables.push(tableVal);
  }

  const ok = tablesOk === allowed.length && colsOk === totalCols;
  const summary = `${tablesOk}/${allowed.length} tables OK, ${colsOk}/${totalCols} columns accessible`;
  return { ok, tables, summary };
}

function buildPostgresSslOptions(connectionString: string, tlsCaPem?: string): false | tls.ConnectionOptions | undefined {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return undefined;
  }

  const extraCaPem = sanitizeTlsCaPem(tlsCaPem);
  const sslmode = (url.searchParams.get("sslmode") ?? "").trim().toLowerCase();
  if (sslmode === "disable") {
    return false;
  }

  if (sslmode === "no-verify") {
    return { rejectUnauthorized: false };
  }

  const hasCustomSslInputs =
    url.searchParams.has("sslrootcert") ||
    url.searchParams.has("sslcert") ||
    url.searchParams.has("sslkey") ||
    url.searchParams.has("sslca");

  // If user provided explicit SSL inputs, let pg-connection-string handle it.
  if (hasCustomSslInputs) {
    return undefined;
  }

  // Use system trust store (plus bundled) so corporate TLS inspection roots installed on the OS are trusted.
  // This preserves rejectUnauthorized=true while improving compatibility for pilots.
  return {
    ca: dedupePem([
      ...safeGetCaCertificates("system"),
      ...safeGetCaCertificates("bundled"),
      ...(extraCaPem ? [extraCaPem] : [])
    ])
  };
}

function safeGetCaCertificates(type: "default" | "system" | "bundled"): string[] {
  if (typeof tls.getCACertificates !== "function") {
    return Array.from(tls.rootCertificates);
  }

  try {
    return Array.from(tls.getCACertificates(type));
  } catch {
    return Array.from(tls.rootCertificates);
  }
}

function dedupePem(pems: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const pem of pems) {
    const value = pem.trim();
    if (!value) {
      continue;
    }

    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    output.push(value);
  }

  return output;
}

function sanitizeTlsCaPem(value?: string): string | undefined {
  const pem = (value ?? "").trim();
  if (!pem) {
    return undefined;
  }

  if (!/-----BEGIN CERTIFICATE-----/i.test(pem)) {
    throw new Error("Advanced TLS CA must be PEM encoded (include a BEGIN CERTIFICATE block).");
  }

  return pem;
}

async function buildDataCatalog(
  pool: Pool,
  businessId: string,
  allowedRelations: string[],
  relationsHealth: RelationHealth[],
  businessContext: string
): Promise<DataCatalog> {
  const tables: TableCatalogEntry[] = [];

  for (const qualifiedName of allowedRelations.slice(0, 30)) {
    const health = relationsHealth.find((r) => r.qualified_name === qualifiedName);
    if (!health || !health.has_select_privilege) continue;

    const [schema, table] = qualifiedName.includes(".")
      ? qualifiedName.split(".", 2)
      : ["public", qualifiedName];

    try {
      const colResult = await pool.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, table]
      );

      const columns: TableColumnInfo[] = colResult.rows.map((row) => ({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable === "YES"
      }));

      let sampleRows: Record<string, unknown>[] = [];
      try {
        const sampleResult = await pool.query(
          `SELECT * FROM ${quoteIdent(schema)}.${quoteIdent(table)} LIMIT 5`
        );
        sampleRows = sampleResult.rows;
      } catch {
        // Some tables may not be queryable (RLS, etc.)
      }

      let rowCountEstimate = 0;
      try {
        const countResult = await pool.query<{ estimate: string }>(
          `SELECT reltuples::bigint AS estimate
           FROM pg_class
           WHERE oid = $1::regclass`,
          [`${quoteIdent(schema)}.${quoteIdent(table)}`]
        );
        rowCountEstimate = Math.max(0, Number.parseInt(countResult.rows[0]?.estimate ?? "0", 10));
      } catch {
        // Estimate unavailable
      }

      const lowCardinalityColumns = await readLowCardinalityColumns(
        pool,
        schema,
        table,
        columns
      );

      const tableIndex = catalogAgentIndexTable({
        business_id: businessId,
        qualified_name: qualifiedName,
        columns: columns.map((column) => ({
          column_name: column.column_name,
          data_type: column.data_type
        })),
        sample_rows: sampleRows,
        low_cardinality_columns: lowCardinalityColumns
      });

      tables.push({
        table_id: tableIndex.table_id,
        qualified_name: qualifiedName,
        relation_type: health.relation_type,
        summary: tableIndex.summary,
        columns,
        low_cardinality_columns: lowCardinalityColumns,
        sample_rows: sampleRows,
        row_count_estimate: rowCountEstimate
      });
    } catch {
      // Skip tables we can't introspect
    }
  }

  return {
    business_id: businessId,
    tables,
    business_context: businessContext,
    cataloged_at: new Date().toISOString()
  };
}

async function buildDataCatalogMySql(
  pool: MySqlPool,
  businessId: string,
  allowedRelations: string[],
  relationsHealth: RelationHealth[],
  businessContext: string
): Promise<DataCatalog> {
  const tables: TableCatalogEntry[] = [];

  for (const qualifiedName of allowedRelations.slice(0, 30)) {
    const health = relationsHealth.find((relation) => relation.qualified_name === qualifiedName);
    if (!health || !health.has_select_privilege) {
      continue;
    }

    const [schema, table] = qualifiedName.includes(".")
      ? qualifiedName.split(".", 2)
      : ["", qualifiedName];

    if (!schema || !table) {
      continue;
    }

    try {
      const [columnRowsRaw] = await pool.query(
        `SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [schema, table]
      );
      const columnRows = toObjectRows(columnRowsRaw);

      const columns: TableColumnInfo[] = columnRows.map((row) => ({
        column_name: String(row.column_name ?? ""),
        data_type: String(row.data_type ?? "unknown"),
        is_nullable: String(row.is_nullable ?? "").toUpperCase() === "YES"
      }));

      let sampleRows: Record<string, unknown>[] = [];
      try {
        const [sampleRowsRaw] = await pool.query(
          `SELECT * FROM ${quoteMySqlIdentifier(schema)}.${quoteMySqlIdentifier(table)} LIMIT 5`
        );
        sampleRows = toObjectRows(sampleRowsRaw);
      } catch {
        // Some tables may not be queryable for sampling.
      }

      let rowCountEstimate = 0;
      try {
        const [estimateRowsRaw] = await pool.query(
          `SELECT TABLE_ROWS AS estimate
           FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           LIMIT 1`,
          [schema, table]
        );
        const estimateRows = toObjectRows(estimateRowsRaw);
        rowCountEstimate = Math.max(0, Number.parseInt(String(estimateRows[0]?.estimate ?? "0"), 10));
      } catch {
        // Estimate unavailable
      }

      const lowCardinalityColumns = await readLowCardinalityColumnsMySql(pool, schema, table, columns);

      const tableIndex = catalogAgentIndexTable({
        business_id: businessId,
        qualified_name: qualifiedName,
        columns: columns.map((column) => ({
          column_name: column.column_name,
          data_type: column.data_type
        })),
        sample_rows: sampleRows,
        low_cardinality_columns: lowCardinalityColumns
      });

      tables.push({
        table_id: tableIndex.table_id,
        qualified_name: qualifiedName,
        relation_type: health.relation_type,
        summary: tableIndex.summary,
        columns,
        low_cardinality_columns: lowCardinalityColumns,
        sample_rows: sampleRows,
        row_count_estimate: rowCountEstimate
      });
    } catch {
      // Skip tables we can't introspect.
    }
  }

  return {
    business_id: businessId,
    tables,
    business_context: businessContext,
    cataloged_at: new Date().toISOString()
  };
}

async function buildDataCatalogSnowflake(
  connection: SnowflakeConnection,
  businessId: string,
  allowedRelations: string[],
  relationsHealth: RelationHealth[],
  businessContext: string,
  config: SnowflakeRuntimeConfig
): Promise<DataCatalog> {
  const tables: TableCatalogEntry[] = [];

  for (const qualifiedName of allowedRelations.slice(0, 30)) {
    const health = relationsHealth.find((relation) => relation.qualified_name === qualifiedName);
    if (!health || !health.has_select_privilege) {
      continue;
    }

    const [schema, table] = qualifiedName.includes(".")
      ? qualifiedName.split(".", 2)
      : [config.schema, qualifiedName];

    if (!schema || !table) {
      continue;
    }

    try {
      const columnRows = await executeSnowflakeStatement(
        connection,
        [
          "SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type, IS_NULLABLE AS is_nullable",
          `FROM ${quoteSnowflakeIdentifier(config.database)}.INFORMATION_SCHEMA.COLUMNS`,
          `WHERE TABLE_SCHEMA = ${quoteLiteral(schema)}`,
          `  AND TABLE_NAME = ${quoteLiteral(table)}`,
          "ORDER BY ORDINAL_POSITION"
        ].join("\n")
      );

      const columns: TableColumnInfo[] = columnRows.map((row) => ({
        column_name: String(row.column_name ?? ""),
        data_type: String(row.data_type ?? "unknown"),
        is_nullable: String(row.is_nullable ?? "").toUpperCase() === "YES"
      }));

      let sampleRows: Record<string, unknown>[] = [];
      try {
        sampleRows = await executeSnowflakeStatement(
          connection,
          `SELECT * FROM ${quoteSnowflakePath(config.database, schema, table)} LIMIT 5`
        );
      } catch {
        // Some relations may not permit sampling.
      }

      const lowCardinalityColumns = await readLowCardinalityColumnsSnowflake(connection, config, schema, table, columns);

      const tableIndex = catalogAgentIndexTable({
        business_id: businessId,
        qualified_name: qualifiedName,
        columns: columns.map((column) => ({
          column_name: column.column_name,
          data_type: column.data_type
        })),
        sample_rows: sampleRows,
        low_cardinality_columns: lowCardinalityColumns
      });

      tables.push({
        table_id: tableIndex.table_id,
        qualified_name: qualifiedName,
        relation_type: health.relation_type,
        summary: tableIndex.summary,
        columns,
        low_cardinality_columns: lowCardinalityColumns,
        sample_rows: sampleRows,
        row_count_estimate: 0
      });
    } catch {
      // Skip relations we can't introspect.
    }
  }

  return {
    business_id: businessId,
    tables,
    business_context: businessContext,
    cataloged_at: new Date().toISOString()
  };
}

async function buildDataCatalogBigQuery(
  client: BigQuery,
  businessId: string,
  allowedRelations: string[],
  relationsHealth: RelationHealth[],
  businessContext: string,
  config: BigQueryRuntimeConfig
): Promise<DataCatalog> {
  const tables: TableCatalogEntry[] = [];

  for (const qualifiedName of allowedRelations.slice(0, 30)) {
    const health = relationsHealth.find((relation) => relation.qualified_name === qualifiedName);
    if (!health || !health.has_select_privilege) {
      continue;
    }

    const [dataset, table] = qualifiedName.includes(".")
      ? qualifiedName.split(".", 2)
      : [config.dataset, qualifiedName];

    if (!dataset || !table) {
      continue;
    }

    try {
      const columnRows = await executeReadOnlyQueryBigQuery(
        client,
        [
          "SELECT column_name, data_type, is_nullable",
          `FROM ${quoteBigQueryInformationSchema(config.project_id, dataset, "COLUMNS")}`,
          `WHERE table_name = ${quoteLiteral(table)}`,
          "ORDER BY ordinal_position"
        ].join("\n"),
        60_000,
        config.location
      );

      const columns: TableColumnInfo[] = columnRows.map((row) => ({
        column_name: String(row.column_name ?? ""),
        data_type: String(row.data_type ?? "unknown"),
        is_nullable: String(row.is_nullable ?? "").toUpperCase() === "YES"
      }));

      let sampleRows: Record<string, unknown>[] = [];
      try {
        sampleRows = await executeReadOnlyQueryBigQuery(
          client,
          `SELECT * FROM ${quoteBigQueryTable(config.project_id, dataset, table)} LIMIT 5`,
          60_000,
          config.location
        );
      } catch {
        // Some relations may not permit sampling.
      }

      const lowCardinalityColumns = await readLowCardinalityColumnsBigQuery(client, config, dataset, table, columns);

      const tableIndex = catalogAgentIndexTable({
        business_id: businessId,
        qualified_name: qualifiedName,
        columns: columns.map((column) => ({
          column_name: column.column_name,
          data_type: column.data_type
        })),
        sample_rows: sampleRows,
        low_cardinality_columns: lowCardinalityColumns
      });

      tables.push({
        table_id: tableIndex.table_id,
        qualified_name: qualifiedName,
        relation_type: health.relation_type,
        summary: tableIndex.summary,
        columns,
        low_cardinality_columns: lowCardinalityColumns,
        sample_rows: sampleRows,
        row_count_estimate: 0
      });
    } catch {
      // Skip relations we can't introspect.
    }
  }

  return {
    business_id: businessId,
    tables,
    business_context: businessContext,
    cataloged_at: new Date().toISOString()
  };
}

const LOW_CARDINALITY_LIMIT = 20;
const MAX_PROFILED_COLUMNS_PER_TABLE = 40;

async function readLowCardinalityColumns(
  pool: Pool,
  schema: string,
  table: string,
  columns: TableColumnInfo[]
): Promise<LowCardinalityColumn[]> {
  const profiles: LowCardinalityColumn[] = [];

  for (const column of columns.slice(0, MAX_PROFILED_COLUMNS_PER_TABLE)) {
    if (!isLowCardinalityCandidateType(column.data_type)) {
      continue;
    }

    try {
      const result = await pool.query<{ value: string }>(
        [
          `SELECT DISTINCT ${quoteIdent(column.column_name)}::text AS value`,
          `FROM ${quoteIdent(schema)}.${quoteIdent(table)}`,
          `WHERE ${quoteIdent(column.column_name)} IS NOT NULL`,
          `LIMIT ${LOW_CARDINALITY_LIMIT + 1}`
        ].join("\n")
      );

      if (result.rows.length === 0 || result.rows.length > LOW_CARDINALITY_LIMIT) {
        continue;
      }

      const distinctValues = result.rows
        .map((row) => sanitizeDistinctValue(row.value))
        .filter((value): value is string => value.length > 0);

      if (distinctValues.length === 0) {
        continue;
      }

      profiles.push({
        column_name: column.column_name,
        distinct_values: distinctValues
      });
    } catch {
      // Skip columns where distinct profiling fails (unsupported cast/type or permissions).
    }
  }

  return profiles;
}

async function readLowCardinalityColumnsMySql(
  pool: MySqlPool,
  schema: string,
  table: string,
  columns: TableColumnInfo[]
): Promise<LowCardinalityColumn[]> {
  const profiles: LowCardinalityColumn[] = [];

  for (const column of columns.slice(0, MAX_PROFILED_COLUMNS_PER_TABLE)) {
    if (!isLowCardinalityCandidateType(column.data_type)) {
      continue;
    }

    try {
      const [rowsRaw] = await pool.query(
        [
          `SELECT DISTINCT CAST(${quoteMySqlIdentifier(column.column_name)} AS CHAR) AS value`,
          `FROM ${quoteMySqlIdentifier(schema)}.${quoteMySqlIdentifier(table)}`,
          `WHERE ${quoteMySqlIdentifier(column.column_name)} IS NOT NULL`,
          `LIMIT ${LOW_CARDINALITY_LIMIT + 1}`
        ].join("\n")
      );
      const rows = toObjectRows(rowsRaw);

      if (rows.length === 0 || rows.length > LOW_CARDINALITY_LIMIT) {
        continue;
      }

      const distinctValues = rows
        .map((row) => sanitizeDistinctValue(String(row.value ?? "")))
        .filter((value): value is string => value.length > 0);

      if (distinctValues.length === 0) {
        continue;
      }

      profiles.push({
        column_name: column.column_name,
        distinct_values: distinctValues
      });
    } catch {
      // Skip columns where distinct profiling fails.
    }
  }

  return profiles;
}

async function readLowCardinalityColumnsSnowflake(
  connection: SnowflakeConnection,
  config: SnowflakeRuntimeConfig,
  schema: string,
  table: string,
  columns: TableColumnInfo[]
): Promise<LowCardinalityColumn[]> {
  const profiles: LowCardinalityColumn[] = [];

  for (const column of columns.slice(0, MAX_PROFILED_COLUMNS_PER_TABLE)) {
    if (!isLowCardinalityCandidateType(column.data_type)) {
      continue;
    }

    try {
      const rows = await executeSnowflakeStatement(
        connection,
        [
          `SELECT DISTINCT CAST(${quoteSnowflakeIdentifier(column.column_name)} AS VARCHAR) AS value`,
          `FROM ${quoteSnowflakePath(config.database, schema, table)}`,
          `WHERE ${quoteSnowflakeIdentifier(column.column_name)} IS NOT NULL`,
          `LIMIT ${LOW_CARDINALITY_LIMIT + 1}`
        ].join("\n")
      );

      if (rows.length === 0 || rows.length > LOW_CARDINALITY_LIMIT) {
        continue;
      }

      const distinctValues = rows
        .map((row) => sanitizeDistinctValue(String(row.value ?? "")))
        .filter((value): value is string => value.length > 0);

      if (distinctValues.length === 0) {
        continue;
      }

      profiles.push({
        column_name: column.column_name,
        distinct_values: distinctValues
      });
    } catch {
      // Skip columns where distinct profiling fails.
    }
  }

  return profiles;
}

async function readLowCardinalityColumnsBigQuery(
  client: BigQuery,
  config: BigQueryRuntimeConfig,
  dataset: string,
  table: string,
  columns: TableColumnInfo[]
): Promise<LowCardinalityColumn[]> {
  const profiles: LowCardinalityColumn[] = [];

  for (const column of columns.slice(0, MAX_PROFILED_COLUMNS_PER_TABLE)) {
    if (!isLowCardinalityCandidateType(column.data_type)) {
      continue;
    }

    try {
      const rows = await executeReadOnlyQueryBigQuery(
        client,
        [
          `SELECT DISTINCT CAST(${quoteBigQueryIdentifier(column.column_name)} AS STRING) AS value`,
          `FROM ${quoteBigQueryTable(config.project_id, dataset, table)}`,
          `WHERE ${quoteBigQueryIdentifier(column.column_name)} IS NOT NULL`,
          `LIMIT ${LOW_CARDINALITY_LIMIT + 1}`
        ].join("\n"),
        60_000,
        config.location
      );

      if (rows.length === 0 || rows.length > LOW_CARDINALITY_LIMIT) {
        continue;
      }

      const distinctValues = rows
        .map((row) => sanitizeDistinctValue(String(row.value ?? "")))
        .filter((value): value is string => value.length > 0);

      if (distinctValues.length === 0) {
        continue;
      }

      profiles.push({
        column_name: column.column_name,
        distinct_values: distinctValues
      });
    } catch {
      // Skip columns where distinct profiling fails.
    }
  }

  return profiles;
}

function isLowCardinalityCandidateType(dataType: string): boolean {
  const normalized = dataType.toLowerCase();
  if (
    normalized.includes("json") ||
    normalized.includes("bytea") ||
    normalized.includes("array") ||
    normalized.includes("tsvector") ||
    normalized.includes("tsquery")
  ) {
    return false;
  }

  return true;
}

function sanitizeDistinctValue(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const trimmed = String(value).trim();
  if (trimmed.length === 0) {
    return "";
  }

  return trimmed.length <= 64 ? trimmed : `${trimmed.slice(0, 61)}...`;
}

function toObjectRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row)
  );
}

function normalizeObjectRows(value: unknown): Record<string, unknown>[] {
  return toObjectRows(value);
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
