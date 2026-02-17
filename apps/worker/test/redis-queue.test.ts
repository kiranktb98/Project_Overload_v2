import { describe, expect, it } from "vitest";
import { RedisRunQueue, type RedisQueueClient } from "../src/redis-queue";

class FakeRedisClient implements RedisQueueClient {
  private readonly store = new Map<string, string[]>();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async quit(): Promise<void> {
    this.connected = false;
  }

  async rPush(key: string, value: string): Promise<number> {
    this.ensureConnected();
    const queue = this.store.get(key) ?? [];
    queue.push(value);
    this.store.set(key, queue);
    return queue.length;
  }

  async lPop(key: string): Promise<string | null> {
    this.ensureConnected();
    const queue = this.store.get(key) ?? [];
    const value = queue.shift() ?? null;
    this.store.set(key, queue);
    return value;
  }

  async lLen(key: string): Promise<number> {
    this.ensureConnected();
    const queue = this.store.get(key) ?? [];
    return queue.length;
  }

  injectRaw(key: string, value: string): void {
    const queue = this.store.get(key) ?? [];
    queue.push(value);
    this.store.set(key, queue);
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error("not connected");
    }
  }
}

describe("redis run queue", () => {
  it("serializes and deserializes jobs in FIFO order", async () => {
    const client = new FakeRedisClient();
    const queue = new RedisRunQueue(client, { queue_key: "test_queue" });

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

  it("rejects invalid payload entries", async () => {
    const client = new FakeRedisClient();
    const queue = new RedisRunQueue(client, { queue_key: "test_queue_invalid" });

    await client.connect();
    client.injectRaw("test_queue_invalid", "not-json");

    await expect(queue.dequeue()).rejects.toThrow("Invalid queue payload");

    await queue.close();
  });
});