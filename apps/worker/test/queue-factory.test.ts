import { afterEach, describe, expect, it } from "vitest";
import { createRunQueueFromEnv } from "../src/queue-factory";
import { InMemoryRunQueue } from "../src/queue";
import { RedisRunQueue } from "../src/redis-queue";

describe("queue factory", () => {
  afterEach(() => {
    delete process.env.WORKER_QUEUE_DRIVER;
    delete process.env.REDIS_URL;
    delete process.env.WORKER_QUEUE_KEY;
  });

  it("returns in-memory queue when driver is memory", () => {
    process.env.WORKER_QUEUE_DRIVER = "memory";
    process.env.REDIS_URL = "redis://localhost:63791";

    const queue = createRunQueueFromEnv();
    expect(queue).toBeInstanceOf(InMemoryRunQueue);
  });

  it("returns in-memory queue when redis url is missing", () => {
    process.env.WORKER_QUEUE_DRIVER = "redis";
    delete process.env.REDIS_URL;

    const queue = createRunQueueFromEnv();
    expect(queue).toBeInstanceOf(InMemoryRunQueue);
  });

  it("returns redis queue when configured", () => {
    process.env.WORKER_QUEUE_DRIVER = "redis";
    process.env.REDIS_URL = "redis://localhost:63791";
    process.env.WORKER_QUEUE_KEY = "po:test";

    const queue = createRunQueueFromEnv();
    expect(queue).toBeInstanceOf(RedisRunQueue);
  });
});