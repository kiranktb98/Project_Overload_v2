import type { ReportContract } from "@project-overload/shared";
import type { WorkerApiClient } from "./api-client";
import type { RunQueue } from "./queue";
import { DeterministicScheduler } from "./scheduler";

export type WorkerRuntimeOptions = {
  api_client: WorkerApiClient;
  scheduler: DeterministicScheduler;
  queue: RunQueue;
  schedule_refresh_ms?: number;
  logger?: (message: string) => void;
};

const DEFAULT_SCHEDULE_REFRESH_MS = 60000;

export class WorkerRuntime {
  private readonly scheduleRefreshMs: number;
  private readonly knownScheduleSignatures = new Map<string, string>();
  private lastScheduleRefreshAt = 0;

  constructor(private readonly options: WorkerRuntimeOptions) {
    this.scheduleRefreshMs = options.schedule_refresh_ms ?? DEFAULT_SCHEDULE_REFRESH_MS;
  }

  async tick(now: Date): Promise<void> {
    await this.refreshSchedulesIfNeeded(now);
    await this.enqueueDueJobs(now);
    await this.dispatchQueuedJobs();
  }

  async refreshSchedules(now: Date): Promise<void> {
    const contracts = await this.options.api_client.listContracts();
    const seenContractIds = new Set<string>();

    for (const contract of contracts) {
      seenContractIds.add(contract.id);
      this.registerOrUpdateSchedule(contract, now);
    }

    for (const contractId of this.knownScheduleSignatures.keys()) {
      if (seenContractIds.has(contractId)) {
        continue;
      }

      this.options.scheduler.unregisterContract(contractId);
      this.knownScheduleSignatures.delete(contractId);
    }

    this.lastScheduleRefreshAt = now.getTime();
  }

  private async refreshSchedulesIfNeeded(now: Date): Promise<void> {
    if (this.lastScheduleRefreshAt === 0) {
      await this.refreshSchedules(now);
      return;
    }

    const elapsedMs = now.getTime() - this.lastScheduleRefreshAt;
    if (elapsedMs >= this.scheduleRefreshMs) {
      await this.refreshSchedules(now);
    }
  }

  private registerOrUpdateSchedule(contract: ReportContract, now: Date): void {
    const existingSignature = this.knownScheduleSignatures.get(contract.id);

    if (!contract.schedule_cron) {
      if (existingSignature) {
        this.options.scheduler.unregisterContract(contract.id);
        this.knownScheduleSignatures.delete(contract.id);
      }
      return;
    }

    const nextSignature = `${contract.schedule_cron}|${contract.timezone}`;
    if (existingSignature === nextSignature) {
      return;
    }

    this.options.scheduler.registerContract(contract.id, contract.schedule_cron, contract.timezone, now);
    this.knownScheduleSignatures.set(contract.id, nextSignature);
  }

  private async enqueueDueJobs(now: Date): Promise<void> {
    const dueJobs = this.options.scheduler.collectDueJobs(now);

    for (const job of dueJobs) {
      await this.options.queue.enqueue(job);
      this.log(`[worker] queued contract=${job.contract_id} scheduled_for=${job.scheduled_for}`);
    }
  }

  private async dispatchQueuedJobs(): Promise<void> {
    let job = await this.options.queue.dequeue();

    while (job) {
      try {
        const run = await this.options.api_client.runContract(job.contract_id);
        this.log(
          `[worker] dispatched contract=${job.contract_id} scheduled_for=${job.scheduled_for} run_id=${run.run_id}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        this.log(`[worker] dispatch failed contract=${job.contract_id}: ${message}`);
      }

      job = await this.options.queue.dequeue();
    }
  }

  private log(message: string): void {
    this.options.logger?.(message);
  }
}
