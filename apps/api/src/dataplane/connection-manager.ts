import { Pool } from "pg";
import {
  assertAllowlistedRelations,
  assertAllowlistedSchemas,
  assertSelectOnly,
  ensureLimit
} from "@project-overload/sql-guard";

export type QueryResultPayload = {
  rows: Record<string, unknown>[];
  row_count: number;
  governed_sql: string;
  warnings: string[];
};

export type ConnectionContext = {
  connected: boolean;
  name: string | null;
  database: string | null;
  connected_at: string | null;
  allowed_relations: string[];
  allowed_schemas: string[];
  available_relations: string[];
  source: "runtime" | "env" | "fallback" | "none";
};

export type ConnectionTestResult = {
  database: string;
  server_version: string;
  available_relations: string[];
};

export type ConnectInput = {
  name?: string;
  connection_string: string;
  allowed_relations?: string[];
};

export type ConnectionManagerOptions = {
  fallback_row_provider?: (sql: string) => Promise<Record<string, unknown>[]> | Record<string, unknown>[];
  fallback_source?: "synthetic" | "postgres";
  default_timeout_ms?: number;
  default_limit?: number;
};

type ActiveConnection = {
  name: string;
  database: string;
  server_version: string;
  connection_string: string;
  pool: Pool;
  connected_at: string;
  allowed_relations: string[];
  available_relations: string[];
  source: "runtime" | "env";
};

const RESERVED_SCHEMAS = ["pg_catalog", "information_schema", "pg_toast"];

export class RuntimeConnectionManager {
  private active: ActiveConnection | null = null;
  private readonly fallbackRowProvider?: ConnectionManagerOptions["fallback_row_provider"];
  private readonly fallbackSource: "synthetic" | "postgres" | null;
  private readonly defaultTimeoutMs: number;
  private readonly defaultLimit: number;

  constructor(options: ConnectionManagerOptions = {}) {
    this.fallbackRowProvider = options.fallback_row_provider;
    this.fallbackSource = options.fallback_source ?? null;
    this.defaultTimeoutMs = options.default_timeout_ms ?? 15000;
    this.defaultLimit = options.default_limit ?? 200;
  }

  async initFromEnv(env: Record<string, string | undefined> = process.env): Promise<void> {
    const source = (env.DATAPLANE_LOCAL_SOURCE ?? "").trim().toLowerCase();
    const connectionString = env.DATAPLANE_LOCAL_PG_URL ?? env.DATABASE_URL;

    if (source !== "postgres" || !connectionString) {
      return;
    }

    const pool = new Pool({
      connectionString,
      max: 5
    });

    try {
      const [metadata, relations] = await Promise.all([
        readConnectionMetadata(pool),
        listRelations(pool)
      ]);

      this.active = {
        name: "env-postgres",
        database: metadata.database,
        server_version: metadata.server_version,
        connection_string: connectionString,
        pool,
        connected_at: new Date().toISOString(),
        available_relations: relations,
        allowed_relations: [...relations],
        source: "env"
      };
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  async testConnection(connectionString: string): Promise<ConnectionTestResult> {
    const pool = new Pool({
      connectionString,
      max: 2
    });

    try {
      const [metadata, relations] = await Promise.all([
        readConnectionMetadata(pool),
        listRelations(pool)
      ]);

      return {
        database: metadata.database,
        server_version: metadata.server_version,
        available_relations: relations
      };
    } finally {
      await pool.end();
    }
  }

  async connect(input: ConnectInput): Promise<ConnectionContext> {
    const pool = new Pool({
      connectionString: input.connection_string,
      max: 5
    });

    try {
      const [metadata, relations] = await Promise.all([
        readConnectionMetadata(pool),
        listRelations(pool)
      ]);

      const allowed = normalizeAllowlist(input.allowed_relations, relations);
      const name = input.name?.trim().length ? input.name.trim() : metadata.database;

      const previous = this.active;
      this.active = {
        name,
        database: metadata.database,
        server_version: metadata.server_version,
        connection_string: input.connection_string,
        pool,
        connected_at: new Date().toISOString(),
        available_relations: relations,
        allowed_relations: allowed,
        source: "runtime"
      };

      if (previous) {
        await previous.pool.end();
      }

      return this.getContext();
    } catch (error) {
      await pool.end();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.active) {
      return;
    }

    await this.active.pool.end();
    this.active = null;
  }

  getContext(): ConnectionContext {
    if (this.active) {
      return {
        connected: true,
        name: this.active.name,
        database: this.active.database,
        connected_at: this.active.connected_at,
        allowed_relations: [...this.active.allowed_relations],
        allowed_schemas: deriveSchemas(this.active.allowed_relations),
        available_relations: [...this.active.available_relations],
        source: this.active.source
      };
    }

    if (this.fallbackRowProvider) {
      return {
        connected: this.fallbackSource === "postgres",
        name: null,
        database: null,
        connected_at: null,
        allowed_relations: [],
        allowed_schemas: [],
        available_relations: [],
        source: "fallback"
      };
    }

    return {
      connected: false,
      name: null,
      database: null,
      connected_at: null,
      allowed_relations: [],
      allowed_schemas: [],
      available_relations: [],
      source: "none"
    };
  }

  getTables(): string[] {
    if (!this.active) {
      return [];
    }

    return [...this.active.available_relations];
  }

  updateAllowlist(allowedRelations: string[]): ConnectionContext {
    if (!this.active) {
      throw new Error("No active database connection.");
    }

    this.active.allowed_relations = normalizeAllowlist(allowedRelations, this.active.available_relations);
    return this.getContext();
  }

  async runSafeQuery(sql: string, requestedLimit?: number): Promise<QueryResultPayload> {
    const limit = sanitizeLimit(requestedLimit, this.defaultLimit);
    assertSelectOnly(sql);
    const governedSql = ensureLimit(sql, limit);

    if (this.active) {
      const allowedRelations = this.active.allowed_relations;
      const allowedSchemas = deriveSchemas(allowedRelations);

      if (allowedRelations.length > 0) {
        assertAllowlistedRelations(governedSql, allowedRelations);
      }

      if (allowedSchemas.length > 0) {
        assertAllowlistedSchemas(governedSql, allowedSchemas);
      }

      const rows = await withTimeout(
        this.active.pool.query(governedSql).then((result) => result.rows as Record<string, unknown>[]),
        this.defaultTimeoutMs
      );

      return {
        rows,
        row_count: rows.length,
        governed_sql: governedSql,
        warnings: []
      };
    }

    if (!this.fallbackRowProvider) {
      throw new Error("No active database connection.");
    }

    const rows = await withTimeout(
      Promise.resolve(this.fallbackRowProvider(governedSql)) as Promise<Record<string, unknown>[]>,
      this.defaultTimeoutMs
    );
    const boundedRows = rows.slice(0, limit);

    return {
      rows: boundedRows,
      row_count: boundedRows.length,
      governed_sql: governedSql,
      warnings: rows.length > limit ? ["Running against fallback provider. Rows were truncated to safe limit."] : ["Running against fallback provider."]
    };
  }

  async rowProvider(sql: string): Promise<Record<string, unknown>[]> {
    if (this.active) {
      const result = await withTimeout(
        this.active.pool.query(sql).then((queryResult) => queryResult.rows as Record<string, unknown>[]),
        this.defaultTimeoutMs
      );

      return result;
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
      await this.active.pool.end();
      this.active = null;
    }
  }
}

async function readConnectionMetadata(
  pool: Pool
): Promise<{ database: string; server_version: string }> {
  const result = await pool.query<{ database: string; server_version: string }>(
    "SELECT current_database() AS database, version() AS server_version"
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Unable to read database metadata.");
  }

  return {
    database: row.database,
    server_version: row.server_version
  };
}

async function listRelations(pool: Pool): Promise<string[]> {
  const result = await pool.query<{
    table_schema: string;
    table_name: string;
  }>(
    `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema <> ALL($1::text[])
      ORDER BY table_schema, table_name
    `,
    [RESERVED_SCHEMAS]
  );

  return result.rows.map((row) => `${row.table_schema}.${row.table_name}`);
}

function deriveSchemas(relations: string[]): string[] {
  return Array.from(
    new Set(
      relations
        .map((relation) => relation.split(".")[0]?.trim().toLowerCase())
        .filter((schema): schema is string => Boolean(schema))
    )
  );
}

function normalizeAllowlist(requested: string[] | undefined, available: string[]): string[] {
  const availableSet = new Set(available.map((entry) => entry.toLowerCase()));
  const normalizedRequested = Array.isArray(requested)
    ? requested
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0)
    : [];

  if (normalizedRequested.length === 0) {
    return [...available];
  }

  const allowed = normalizedRequested.filter((entry) => availableSet.has(entry));
  if (allowed.length === 0) {
    throw new Error("None of the provided allowlisted tables exist in the connected database.");
  }

  return Array.from(new Set(allowed));
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
