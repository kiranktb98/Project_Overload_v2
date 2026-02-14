import type { ScheduledJob } from "./scheduler";

export class InMemoryRunQueue {
  private readonly jobs: ScheduledJob[] = [];

  enqueue(job: ScheduledJob): void {
    this.jobs.push(job);
  }

  dequeue(): ScheduledJob | undefined {
    return this.jobs.shift();
  }

  size(): number {
    return this.jobs.length;
  }
}