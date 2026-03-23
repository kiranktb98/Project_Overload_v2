import { describe, expect, it } from "vitest";
import type { BigQuery } from "@google-cloud/bigquery";
import type {
  Connection as SnowflakeConnection,
  StatementOption as SnowflakeStatementOption
} from "snowflake-sdk";
import { RuntimeConnectionManager } from "../src/dataplane/connection-manager";

class FakeSnowflakeConnection {
  public readonly executedSql: string[] = [];
  public destroyed = false;

  connect(callback: (error?: Error | null) => void): void {
    callback(null);
  }

  execute(options: SnowflakeStatementOption): void {
    const sql = String(options.sqlText ?? "");
    this.executedSql.push(sql);

    let rows: Record<string, unknown>[] = [];
    if (sql.includes("CURRENT_USER()")) {
      rows = [
        {
          current_user: "REPORT_READER",
          current_database: "TESTDB",
          version: "Snowflake 9.x"
        }
      ];
    } else if (sql.includes("INFORMATION_SCHEMA.TABLES")) {
      rows = [
        {
          schema_name: "PUBLIC",
          relation_name: "REFUNDS",
          relation_type: "BASE TABLE"
        }
      ];
    } else if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) {
      rows = [
        {
          column_name: "REFUND_RATE",
          data_type: "FLOAT",
          is_nullable: "YES"
        },
        {
          column_name: "ISSUE_TYPE",
          data_type: "TEXT",
          is_nullable: "YES"
        }
      ];
    } else if (sql.includes('SELECT "REFUND_RATE" FROM "TESTDB"."PUBLIC"."REFUNDS" LIMIT 1')) {
      rows = [{ REFUND_RATE: 19.62 }];
    } else if (sql.includes('SELECT "ISSUE_TYPE" FROM "TESTDB"."PUBLIC"."REFUNDS" LIMIT 1')) {
      rows = [{ ISSUE_TYPE: "Damaged" }];
    } else if (sql.includes('SELECT * FROM "TESTDB"."PUBLIC"."REFUNDS" LIMIT 5')) {
      rows = [{ REFUND_RATE: 19.62, ISSUE_TYPE: "Damaged" }];
    } else if (sql.includes('SELECT * FROM "TESTDB"."PUBLIC"."REFUNDS" LIMIT 0')) {
      rows = [];
    } else if (sql.includes('CAST("ISSUE_TYPE" AS VARCHAR)')) {
      rows = [{ value: "Damaged" }, { value: "Late delivery" }];
    } else if (sql.includes('SELECT "REFUND_RATE" FROM "PUBLIC"."REFUNDS" LIMIT 200')) {
      rows = [{ REFUND_RATE: 19.62 }];
    }

    options.complete?.(undefined, {} as never, rows);
  }

  destroy(callback: (error?: Error | null) => void): void {
    this.destroyed = true;
    callback(null);
  }
}

class FakeBigQueryClient {
  public readonly queries: string[] = [];

  async query(options: { query: string }): Promise<[Record<string, unknown>[]]> {
    const sql = options.query;
    this.queries.push(sql);

    if (sql.includes("SESSION_USER()")) {
      return [[{ current_user: "reader@example.com" }]];
    }

    if (sql.includes("INFORMATION_SCHEMA.TABLES")) {
      return [[{ schema_name: "analytics", relation_name: "refunds", relation_type: "BASE TABLE" }]];
    }

    if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) {
      return [[
        { column_name: "refund_rate", data_type: "FLOAT64", is_nullable: "YES" },
        { column_name: "issue_type", data_type: "STRING", is_nullable: "YES" }
      ]];
    }

    if (sql.includes("CAST(`issue_type` AS STRING)")) {
      return [[{ value: "Damaged" }, { value: "Late delivery" }]];
    }

    if (sql.includes("SELECT * FROM `demo-project.analytics.refunds` LIMIT 5")) {
      return [[{ refund_rate: 19.62, issue_type: "Damaged" }]];
    }

    if (sql.includes("SELECT refund_rate FROM `demo-project.analytics.refunds` LIMIT 200")) {
      return [[{ refund_rate: 19.62 }]];
    }

    if (sql.includes("SELECT * FROM `demo-project.analytics.refunds` LIMIT 0")) {
      return [[]];
    }

    if (sql.includes("SELECT `refund_rate` FROM `demo-project.analytics.refunds` LIMIT 1")) {
      return [[{ refund_rate: 19.62 }]];
    }

    if (sql.includes("SELECT `issue_type` FROM `demo-project.analytics.refunds` LIMIT 1")) {
      return [[{ issue_type: "Damaged" }]];
    }

    throw new Error(`Unexpected BigQuery SQL in test: ${sql}`);
  }
}

describe("RuntimeConnectionManager cloud connectors", () => {
  it("tests Snowflake connections, runs governed safe queries, and generates a Snowflake fix script", async () => {
    const fakeConnection = new FakeSnowflakeConnection();
    const manager = new RuntimeConnectionManager({
      snowflake_connection_factory: () =>
        fakeConnection as unknown as SnowflakeConnection
    });

    const result = await manager.testConnection(
      "snowflake://reader:secret@acme/testdb/public?warehouse=COMPUTE_WH",
      undefined,
      "snowflake"
    );

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("snowflake");
    expect(result.metadata.current_database).toBe("TESTDB");
    expect(result.recommended_allowlist).toEqual(["PUBLIC.REFUNDS"]);
    expect(fakeConnection.destroyed).toBe(true);

    const context = await manager.connect({
      provider: "snowflake",
      name: "Snowflake test",
      connection_string: "snowflake://reader:secret@acme/testdb/public?warehouse=COMPUTE_WH",
      allowed_relations: ["public.refunds"],
      business_context: "Refund monitoring"
    });

    expect(context.connected).toBe(true);
    expect(context.provider).toBe("snowflake");
    expect(context.allowed_relations).toEqual(["public.refunds"]);

    const queryResult = await manager.runSafeQuery('SELECT "REFUND_RATE" FROM "PUBLIC"."REFUNDS"');
    expect(queryResult.row_count).toBe(1);
    expect(queryResult.governed_sql).toContain("LIMIT 200");
    expect(queryResult.rows[0]).toEqual({ REFUND_RATE: 19.62 });

    const script = manager.generateFixScript({
      allowlisted_relations: ["public.refunds"],
      reader_role: "reader_user"
    });
    expect(script).toContain("CREATE ROLE IF NOT EXISTS");
    expect(script).toContain("GRANT USAGE ON DATABASE");
    expect(script).toContain('"TESTDB"."public"."refunds"');
  });

  it("connects BigQuery, builds catalog, and runs allowlisted read-only queries", async () => {
    const fakeClient = new FakeBigQueryClient();
    const manager = new RuntimeConnectionManager({
      bigquery_client_factory: () => fakeClient as unknown as BigQuery
    });

    const context = await manager.connect({
      provider: "bigquery",
      name: "BigQuery test",
      connection_string: "bigquery://demo-project/analytics?location=US",
      allowed_relations: ["analytics.refunds"],
      business_context: "Refund monitoring"
    });

    expect(context.connected).toBe(true);
    expect(context.provider).toBe("bigquery");
    expect(context.allowed_relations).toEqual(["analytics.refunds"]);
    expect(manager.getCatalog()?.tables.map((table) => table.qualified_name)).toEqual(["analytics.refunds"]);

    const result = await manager.runSafeQuery("SELECT refund_rate FROM `demo-project.analytics.refunds`");
    expect(result.row_count).toBe(1);
    expect(result.rows[0]).toEqual({ refund_rate: 19.62 });
    expect(result.governed_sql).toContain("LIMIT 200");
  });
});
