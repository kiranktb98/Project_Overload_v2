import { describe, expect, it } from "vitest";
import { DeterministicScheduler, computeNextRun, parseCronSchedule } from "../src/scheduler";

describe("worker scheduler", () => {
  it("parses cron+timezone and computes deterministic next run", () => {
    const schedule = parseCronSchedule("0 18 * * 5", "Asia/Kolkata");
    const from = new Date("2026-02-13T12:00:00.000Z");
    const next = computeNextRun(schedule, from);

    expect(next.toISOString()).toBe("2026-02-13T12:30:00.000Z");
  });

  it("queues due jobs deterministically", () => {
    const scheduler = new DeterministicScheduler();
    const start = new Date("2026-01-01T00:00:00.000Z");

    scheduler.registerContract("contract_1", "*/10 * * * *", "UTC", start);

    const dueAtFive = scheduler.collectDueJobs(new Date("2026-01-01T00:05:00.000Z"));
    expect(dueAtFive).toHaveLength(0);

    const dueAtTen = scheduler.collectDueJobs(new Date("2026-01-01T00:10:00.000Z"));
    expect(dueAtTen).toHaveLength(1);
    expect(dueAtTen[0].contract_id).toBe("contract_1");
  });
});