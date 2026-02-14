import type { ScheduledJob } from "./scheduler";

export interface RunQueue {
  enqueue(job: ScheduledJob): Promise<void>;
  dequeue(): Promise<ScheduledJob | undefined>;
  size(): Promise<number>;
  close(): Promise<void>;
}

export class InMemoryRunQueue implements RunQueue {
  private readonly jobs: ScheduledJob[] = [];

  async enqueue(job: ScheduledJob): Promise<void> {
    this.jobs.push(job);
  }

  async dequeue(): Promise<ScheduledJob | undefined> {
    return this.jobs.shift();
  }

  async size(): Promise<number> {
    return this.jobs.length;
  }

  async close(): Promise<void> {
    this.jobs.length = 0;
  }
}
