import { InMemoryRunQueue, type RunQueue } from "./queue";
import { RedisRunQueue } from "./redis-queue";

export type QueueDriver = "memory" | "redis";

export function createRunQueueFromEnv(): RunQueue {
  const driver = parseDriver(process.env.WORKER_QUEUE_DRIVER);

  if (driver === "memory") {
    return new InMemoryRunQueue();
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return new InMemoryRunQueue();
  }

  return RedisRunQueue.fromUrl({
    redis_url: redisUrl,
    queue_key: process.env.WORKER_QUEUE_KEY
  });
}

function parseDriver(rawValue: string | undefined): QueueDriver {
  const normalized = (rawValue ?? "").toLowerCase();

  if (normalized === "memory") {
    return "memory";
  }

  return "redis";
}