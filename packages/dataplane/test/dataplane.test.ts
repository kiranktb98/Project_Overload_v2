import { describe, expect, it } from "vitest";
import { LocalStubDataPlane } from "../src";

describe("LocalStubDataPlane", () => {
  it("enforces SELECT-only", async () => {
    const dataPlane = new LocalStubDataPlane();

    await expect(
      dataPlane.execute({
        request_id: "req_1",
        sql: "UPDATE analytics.sales SET amount = 0",
        policy: {
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 1000,
          row_cap: 200,
          pii_fields: []
        }
      })
    ).rejects.toThrow();
  });

  it("enforces allowlist and masks pii", async () => {
    const dataPlane = new LocalStubDataPlane({
      row_provider: () => [
        { id: 1, customer_email: "user@example.com", amount: 100, region: "NA" },
        { id: 2, customer_email: "user2@example.com", amount: 50, region: "EU" }
      ]
    });

    const result = await dataPlane.execute({
      request_id: "req_2",
      sql: "SELECT * FROM analytics.sales",
      policy: {
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 1000,
        row_cap: 200,
        pii_fields: ["customer_email"]
      }
    });

    expect(result.rows[0].customer_email).toBe("[REDACTED]");
    expect(result.audit_event.row_count).toBe(2);

    await expect(
      dataPlane.execute({
        request_id: "req_3",
        sql: "SELECT * FROM private.sales",
        policy: {
          allowed_relations: ["analytics.sales"],
          allowed_schemas: ["analytics"],
          timeout_ms: 1000,
          row_cap: 200,
          pii_fields: []
        }
      })
    ).rejects.toThrow();
  });

  it("records audit events", async () => {
    const dataPlane = new LocalStubDataPlane({
      row_provider: () => [{ id: 1 }]
    });

    await dataPlane.execute({
      request_id: "req_4",
      sql: "SELECT * FROM analytics.sales",
      policy: {
        allowed_relations: ["analytics.sales"],
        allowed_schemas: ["analytics"],
        timeout_ms: 1000,
        row_cap: 200,
        pii_fields: []
      }
    });

    const events = dataPlane.getAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0].request_id).toBe("req_4");
  });
});