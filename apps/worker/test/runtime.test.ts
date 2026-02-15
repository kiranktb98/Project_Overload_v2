import { describe, expect, it } from "vitest";
import type { ReportContract } from "@project-overload/shared";
import { InMemoryRunQueue } from "../src/queue";
import { WorkerRuntime } from "../src/runtime";
import { DeterministicScheduler } from "../src/scheduler";

describe("worker runtime", () => {
  it("refreshes scheduled contracts and dispatches due runs", async () => {
    const listCalls: number[] = [];
    const runCalls: string[] = [];

    const runtime = new WorkerRuntime({
      api_client: {
        async listContracts() {
          listCalls.push(Date.now());
          return [createContract("contract_weekly", "*/5 * * * *")];
        },
        async runContract(contractId: string) {
          runCalls.push(contractId);
          return { run_id: `run_${contractId}` };
        }
      },
      scheduler: new DeterministicScheduler(),
      queue: new InMemoryRunQueue(),
      schedule_refresh_ms: 60 * 60 * 1000
    });

    await runtime.tick(new Date("2026-01-01T00:00:00.000Z"));
    await runtime.tick(new Date("2026-01-01T00:05:00.000Z"));

    expect(listCalls).toHaveLength(1);
    expect(runCalls).toEqual(["contract_weekly"]);
  });

  it("removes schedule when contract schedule_cron becomes null", async () => {
    const runCalls: string[] = [];
    let callCount = 0;

    const runtime = new WorkerRuntime({
      api_client: {
        async listContracts() {
          callCount += 1;

          if (callCount === 1) {
            return [createContract("contract_ops", "*/5 * * * *")];
          }

          return [createContract("contract_ops", null)];
        },
        async runContract(contractId: string) {
          runCalls.push(contractId);
          return { run_id: `run_${contractId}` };
        }
      },
      scheduler: new DeterministicScheduler(),
      queue: new InMemoryRunQueue(),
      schedule_refresh_ms: 1000
    });

    await runtime.tick(new Date("2026-01-01T00:00:00.000Z"));
    await runtime.tick(new Date("2026-01-01T00:00:02.000Z"));
    await runtime.tick(new Date("2026-01-01T00:05:00.000Z"));

    expect(runCalls).toHaveLength(0);
  });

  it("continues dispatching queue when one run call fails", async () => {
    const runCalls: string[] = [];

    const runtime = new WorkerRuntime({
      api_client: {
        async listContracts() {
          return [
            createContract("contract_1", "*/1 * * * *"),
            createContract("contract_2", "*/1 * * * *")
          ];
        },
        async runContract(contractId: string) {
          runCalls.push(contractId);

          if (contractId === "contract_1") {
            throw new Error("simulated failure");
          }

          return { run_id: `run_${contractId}` };
        }
      },
      scheduler: new DeterministicScheduler(),
      queue: new InMemoryRunQueue(),
      schedule_refresh_ms: 60 * 60 * 1000
    });

    await runtime.tick(new Date("2026-01-01T00:00:00.000Z"));
    await runtime.tick(new Date("2026-01-01T00:01:00.000Z"));

    expect(runCalls).toEqual(["contract_1", "contract_2"]);
  });
});

function createContract(contractId: string, scheduleCron: string | null): ReportContract {
  return {
    id: contractId,
    name: `${contractId} report`,
    audience: "Executive",
    timezone: "UTC",
    schedule_cron: scheduleCron,
    sql_template: "SELECT * FROM analytics.sales",
    metric_ids: ["metric_revenue"],
    dimension_ids: ["region"],
    guardrails: {
      evidence_row_cap: 200,
      max_batches: 5,
      allowed_relations: ["analytics.sales"],
      allowed_schemas: ["analytics"],
      timeout_ms: 15000,
      deny_write: true
    }
  };
}
