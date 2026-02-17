import {
  assertAllowlistedRelations,
  assertAllowlistedSchemas,
  assertSelectOnly,
  ensureLimit
} from "@project-overload/sql-guard";

export type DataPlanePolicy = {
  allowed_relations: string[];
  allowed_schemas: string[];
  timeout_ms: number;
  row_cap: number;
  pii_fields: string[];
  mask_value?: string;
};

export type DataPlaneQueryRequest = {
  request_id: string;
  sql: string;
  policy: DataPlanePolicy;
};

export type DataPlaneAuditEvent = {
  request_id: string;
  sql: string;
  governed_sql: string;
  row_count: number;
  truncated: boolean;
  occurred_at: string;
};

export type DataPlaneQueryResult = {
  rows: Record<string, unknown>[];
  row_count: number;
  governed_sql: string;
  audit_event: DataPlaneAuditEvent;
};

export type DataPlaneHooks = {
  before_execute?: (request: DataPlaneQueryRequest) => Promise<void> | void;
  after_execute?: (auditEvent: DataPlaneAuditEvent) => Promise<void> | void;
};

export interface DataPlane {
  execute(request: DataPlaneQueryRequest): Promise<DataPlaneQueryResult>;
  getAuditEvents(): DataPlaneAuditEvent[];
}

export type LocalStubDataPlaneOptions = {
  row_provider?: (sql: string) => Promise<Record<string, unknown>[]> | Record<string, unknown>[];
  hooks?: DataPlaneHooks;
};

export type Fetcher = typeof fetch;

export type RemoteAgentDataPlaneOptions = {
  base_url: string;
  api_key?: string;
  query_endpoint?: string;
  timeout_ms?: number;
  fetcher?: Fetcher;
  hooks?: DataPlaneHooks;
};

export type DataPlaneMode = "local" | "hybrid" | "saas";

export type CreateDataPlaneFromEnvOptions = {
  local_stub_options?: LocalStubDataPlaneOptions;
  remote_agent_options?: Partial<
    Pick<RemoteAgentDataPlaneOptions, "query_endpoint" | "timeout_ms" | "api_key" | "hooks">
  >;
  fetcher?: Fetcher;
};

const DEFAULT_AGENT_QUERY_ENDPOINT = "/v1/query";
const DEFAULT_AGENT_TIMEOUT_MS = 15000;

function maskRow(row: Record<string, unknown>, piiFields: string[], maskValue: string): Record<string, unknown> {
  if (piiFields.length === 0) {
    return row;
  }

  const piiFieldSet = new Set(piiFields);
  const masked: Record<string, unknown> = { ...row };

  for (const field of piiFieldSet) {
    if (field in masked) {
      masked[field] = maskValue;
    }
  }

  return masked;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`DataPlane timeout after ${timeoutMs}ms`));
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

async function fetchWithTimeout(
  fetcher: Fetcher,
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export class LocalStubDataPlane implements DataPlane {
  private readonly auditEvents: DataPlaneAuditEvent[] = [];

  constructor(private readonly options: LocalStubDataPlaneOptions = {}) {}

  async execute(request: DataPlaneQueryRequest): Promise<DataPlaneQueryResult> {
    await this.options.hooks?.before_execute?.(request);

    assertSelectOnly(request.sql);

    if (request.policy.allowed_relations.length > 0) {
      assertAllowlistedRelations(request.sql, request.policy.allowed_relations);
    }

    if (request.policy.allowed_schemas.length > 0) {
      assertAllowlistedSchemas(request.sql, request.policy.allowed_schemas);
    }

    const governedSql = ensureLimit(request.sql, request.policy.row_cap);
    const rowProvider = this.options.row_provider ?? defaultRowProvider;

    const providedRows = await withTimeout(
      Promise.resolve(rowProvider(governedSql)),
      request.policy.timeout_ms
    );

    const truncatedRows = providedRows.slice(0, request.policy.row_cap).map((row) =>
      maskRow(row, request.policy.pii_fields, request.policy.mask_value ?? "[REDACTED]")
    );

    const auditEvent: DataPlaneAuditEvent = {
      request_id: request.request_id,
      sql: request.sql,
      governed_sql: governedSql,
      row_count: truncatedRows.length,
      truncated: providedRows.length > request.policy.row_cap,
      occurred_at: new Date().toISOString()
    };

    this.auditEvents.push(auditEvent);
    await this.options.hooks?.after_execute?.(auditEvent);

    return {
      rows: truncatedRows,
      row_count: truncatedRows.length,
      governed_sql: governedSql,
      audit_event: auditEvent
    };
  }

  getAuditEvents(): DataPlaneAuditEvent[] {
    return [...this.auditEvents];
  }
}

export class RemoteAgentDataPlane implements DataPlane {
  private readonly auditEvents: DataPlaneAuditEvent[] = [];

  constructor(private readonly options: RemoteAgentDataPlaneOptions) {}

  async execute(request: DataPlaneQueryRequest): Promise<DataPlaneQueryResult> {
    await this.options.hooks?.before_execute?.(request);

    // Local preflight keeps core guardrails in place even with remote execution.
    assertSelectOnly(request.sql);

    if (request.policy.allowed_relations.length > 0) {
      assertAllowlistedRelations(request.sql, request.policy.allowed_relations);
    }

    if (request.policy.allowed_schemas.length > 0) {
      assertAllowlistedSchemas(request.sql, request.policy.allowed_schemas);
    }

    const endpoint = buildAgentEndpoint(this.options.base_url, this.options.query_endpoint);
    const timeoutMs = this.options.timeout_ms ?? DEFAULT_AGENT_TIMEOUT_MS;
    const fetcher = this.options.fetcher ?? fetch;

    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (this.options.api_key) {
      headers.Authorization = `Bearer ${this.options.api_key}`;
    }

    const response = await fetchWithTimeout(
      fetcher,
      endpoint,
      {
        method: "POST",
        headers,
        body: JSON.stringify(request)
      },
      timeoutMs
    );

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Remote Data Plane request failed (${response.status}): ${responseText}`);
    }

    const payload = (await response.json()) as unknown;
    const parsed = parseDataPlaneQueryResult(payload);

    this.auditEvents.push(parsed.audit_event);
    await this.options.hooks?.after_execute?.(parsed.audit_event);

    return parsed;
  }

  getAuditEvents(): DataPlaneAuditEvent[] {
    return [...this.auditEvents];
  }
}

export function createDataPlaneFromEnv(options: CreateDataPlaneFromEnvOptions = {}): DataPlane {
  const mode = parseDataPlaneMode(process.env.DATAPLANE_MODE);

  if (mode === "local") {
    return new LocalStubDataPlane(options.local_stub_options);
  }

  const agentUrl = process.env.DATAPLANE_AGENT_URL;
  if (!agentUrl) {
    return new LocalStubDataPlane(options.local_stub_options);
  }

  const timeoutFromEnv = Number.parseInt(
    process.env.DATAPLANE_AGENT_TIMEOUT_MS ?? process.env.DEFAULT_QUERY_TIMEOUT_MS ?? "",
    10
  );

  return new RemoteAgentDataPlane({
    base_url: agentUrl,
    api_key: options.remote_agent_options?.api_key ?? process.env.DATAPLANE_AGENT_API_KEY,
    query_endpoint:
      options.remote_agent_options?.query_endpoint ?? process.env.DATAPLANE_AGENT_QUERY_ENDPOINT,
    timeout_ms:
      options.remote_agent_options?.timeout_ms ??
      (Number.isNaN(timeoutFromEnv) ? DEFAULT_AGENT_TIMEOUT_MS : timeoutFromEnv),
    hooks: options.remote_agent_options?.hooks,
    fetcher: options.fetcher
  });
}

function parseDataPlaneMode(rawMode: string | undefined): DataPlaneMode {
  const normalized = (rawMode ?? "local").toLowerCase();

  if (normalized === "hybrid") {
    return "hybrid";
  }

  if (normalized === "saas") {
    return "saas";
  }

  return "local";
}

function buildAgentEndpoint(baseUrl: string, queryEndpoint = DEFAULT_AGENT_QUERY_ENDPOINT): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = queryEndpoint.startsWith("/") ? queryEndpoint : `/${queryEndpoint}`;
  return `${normalizedBase}${normalizedPath}`;
}

function parseDataPlaneQueryResult(payload: unknown): DataPlaneQueryResult {
  if (!isRecord(payload)) {
    throw new Error("Invalid Data Plane response payload.");
  }

  if (!Array.isArray(payload.rows)) {
    throw new Error("Invalid Data Plane response payload: rows must be an array.");
  }

  if (typeof payload.row_count !== "number" || Number.isNaN(payload.row_count)) {
    throw new Error("Invalid Data Plane response payload: row_count must be a number.");
  }

  if (typeof payload.governed_sql !== "string") {
    throw new Error("Invalid Data Plane response payload: governed_sql must be a string.");
  }

  if (!isRecord(payload.audit_event)) {
    throw new Error("Invalid Data Plane response payload: audit_event must be an object.");
  }

  const auditEvent = payload.audit_event;

  if (
    typeof auditEvent.request_id !== "string" ||
    typeof auditEvent.sql !== "string" ||
    typeof auditEvent.governed_sql !== "string" ||
    typeof auditEvent.row_count !== "number" ||
    typeof auditEvent.truncated !== "boolean" ||
    typeof auditEvent.occurred_at !== "string"
  ) {
    throw new Error("Invalid Data Plane response payload: audit_event fields are invalid.");
  }

  return {
    rows: payload.rows.map((row) => {
      if (!isRecord(row)) {
        throw new Error("Invalid Data Plane response payload: row must be an object.");
      }

      return row;
    }),
    row_count: payload.row_count,
    governed_sql: payload.governed_sql,
    audit_event: {
      request_id: auditEvent.request_id,
      sql: auditEvent.sql,
      governed_sql: auditEvent.governed_sql,
      row_count: auditEvent.row_count,
      truncated: auditEvent.truncated,
      occurred_at: auditEvent.occurred_at
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultRowProvider(): Record<string, unknown>[] {
  return Array.from({ length: 120 }, (_, index) => ({
    id: index + 1,
    customer_email: `customer${index + 1}@example.com`,
    amount: (index % 20) + 1,
    region: ["NA", "EU", "APAC"][index % 3],
    order_date: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`
  }));
}