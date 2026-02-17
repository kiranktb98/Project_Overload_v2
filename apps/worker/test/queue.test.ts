import { describe, expect, it } from "vitest";
import { InMemoryRunQueue } from "../src/queue";

describe("in-memory run queue", () => {
  it("preserves FIFO ordering", async () => {
    const queue = new InMemoryRunQueue();

    await queue.enqueue({ contract_id: "c1", scheduled_for: "2026-01-01T00:00:00.000Z" });
    await queue.enqueue({ contract_id: "c2", scheduled_for: "2026-01-01T00:01:00.000Z" });

    expect(await queue.size()).toBe(2);

    const first = await queue.dequeue();
    const second = await queue.dequeue();
    const third = await queue.dequeue();

    expect(first?.contract_id).toBe("c1");
    expect(second?.contract_id).toBe("c2");
    expect(third).toBeUndefined();

    await queue.close();
  });
});