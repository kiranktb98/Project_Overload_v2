import { createClient, type RedisClientType } from "redis";
import type { ScheduledJob } from "./scheduler";
import type { RunQueue } from "./queue";

const DEFAULT_QUEUE_KEY = "po_v2:worker:run_queue";

export type RedisRunQueueOptions = {
  redis_url: string;
  queue_key?: string;
};

export type RedisQueueClient = {
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
  rPush(key: string, value: string): Promise<number>;
  lPop(key: string): Promise<string | null>;
  lLen(key: string): Promise<number>;
};

export class RedisRunQueue implements RunQueue {
  private readonly queueKey: string;
  private isConnected = false;

  constructor(
    private readonly client: RedisQueueClient,
    options: { queue_key?: string } = {}
  ) {
    this.queueKey = options.queue_key ?? DEFAULT_QUEUE_KEY;
  }

  static fromUrl(options: RedisRunQueueOptions): RedisRunQueue {
    const client = createClient({
      url: options.redis_url
    }) as RedisClientType;

    return new RedisRunQueue(client, {
      queue_key: options.queue_key
    });
  }

  async enqueue(job: ScheduledJob): Promise<void> {
    await this.ensureConnected();
    await this.client.rPush(this.queueKey, JSON.stringify(job));
  }

  async dequeue(): Promise<ScheduledJob | undefined> {
    await this.ensureConnected();
    const payload = await this.client.lPop(this.queueKey);

    if (!payload) {
      return undefined;
    }

    return parseScheduledJob(payload);
  }

  async size(): Promise<number> {
    await this.ensureConnected();
    return this.client.lLen(this.queueKey);
  }

  async close(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await this.client.quit();
    this.isConnected = false;
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    await this.client.connect();
    this.isConnected = true;
  }
}

function parseScheduledJob(payload: string): ScheduledJob {
  let parsed: unknown;

  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("Invalid queue payload: expected JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid queue payload: expected object.");
  }

  if (typeof parsed.contract_id !== "string" || typeof parsed.scheduled_for !== "string") {
    throw new Error("Invalid queue payload: missing required fields.");
  }

  return {
    contract_id: parsed.contract_id,
    scheduled_for: parsed.scheduled_for,
    attempt: typeof parsed.attempt === "number" ? Math.max(1, Math.trunc(parsed.attempt)) : 1,
    retry_of_run_id: typeof parsed.retry_of_run_id === "string" ? parsed.retry_of_run_id : null,
    next_eligible_at: typeof parsed.next_eligible_at === "string" ? parsed.next_eligible_at : null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
