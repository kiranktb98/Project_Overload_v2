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

function defaultRowProvider(): Record<string, unknown>[] {
  return Array.from({ length: 120 }, (_, index) => ({
    id: index + 1,
    customer_email: `customer${index + 1}@example.com`,
    amount: (index % 20) + 1,
    region: ["NA", "EU", "APAC"][index % 3],
    order_date: `2025-01-${String((index % 28) + 1).padStart(2, "0")}`
  }));
}