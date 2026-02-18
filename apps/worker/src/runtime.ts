import type { ReportContract } from "@project-overload/shared";
import type { WorkerApiClient } from "./api-client";
import type { RunQueue } from "./queue";
import { DeterministicScheduler } from "./scheduler";

export type WorkerRuntimeOptions = {
  api_client: WorkerApiClient;
  scheduler: DeterministicScheduler;
  queue: RunQueue;
  schedule_refresh_ms?: number;
  max_retry_attempts?: number;
  retry_backoff_ms?: number;
  logger?: (message: string) => void;
};

const DEFAULT_SCHEDULE_REFRESH_MS = 60000;
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_BACKOFF_MS = 30_000;

export class WorkerRuntime {
  private readonly scheduleRefreshMs: number;
  private readonly maxRetryAttempts: number;
  private readonly retryBackoffMs: number;
  private readonly knownScheduleSignatures = new Map<string, string>();
  private readonly deadLetterJobs: Array<{ contract_id: string; scheduled_for: string; attempt: number; error: string }> = [];
  private lastScheduleRefreshAt = 0;

  constructor(private readonly options: WorkerRuntimeOptions) {
    this.scheduleRefreshMs = options.schedule_refresh_ms ?? DEFAULT_SCHEDULE_REFRESH_MS;
    this.maxRetryAttempts = options.max_retry_attempts ?? DEFAULT_MAX_RETRY_ATTEMPTS;
    this.retryBackoffMs = options.retry_backoff_ms ?? DEFAULT_RETRY_BACKOFF_MS;
  }

  async tick(now: Date): Promise<void> {
    await this.refreshSchedulesIfNeeded(now);
    await this.enqueueDueJobs(now);
    await this.dispatchQueuedJobs(now);
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

    if (!contract.schedule_cron || contract.lifecycle_status !== "locked") {
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

  getDeadLetterJobs(): Array<{ contract_id: string; scheduled_for: string; attempt: number; error: string }> {
    return [...this.deadLetterJobs];
  }

  private async dispatchQueuedJobs(now: Date): Promise<void> {
    let job = await this.options.queue.dequeue();
    let safetyCounter = (await this.options.queue.size()) + 20;

    while (job && safetyCounter > 0) {
      safetyCounter -= 1;
      const nextEligibleAt = parseTimestamp(job.next_eligible_at);
      if (nextEligibleAt && nextEligibleAt.getTime() > now.getTime()) {
        await this.options.queue.enqueue(job);
        this.log(
          `[worker] retry delayed contract=${job.contract_id} attempt=${job.attempt ?? 1} next_eligible_at=${job.next_eligible_at}`
        );
        break;
      }

      const attempt = normalizeAttempt(job.attempt);
      try {
        const run = await this.options.api_client.runContract(job.contract_id, {
          trigger: attempt > 1 ? "retry" : "scheduled",
          attempt,
          retry_of_run_id: job.retry_of_run_id ?? null
        });
        this.log(
          `[worker] dispatched contract=${job.contract_id} scheduled_for=${job.scheduled_for} attempt=${attempt} run_id=${run.run_id}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        if (attempt < this.maxRetryAttempts) {
          const delayMs = this.retryBackoffMs * Math.pow(2, attempt - 1);
          const nextJob = {
            ...job,
            attempt: attempt + 1,
            retry_of_run_id: job.retry_of_run_id ?? null,
            next_eligible_at: new Date(now.getTime() + delayMs).toISOString()
          };
          await this.options.queue.enqueue(nextJob);
          this.log(
            `[worker] dispatch failed contract=${job.contract_id} attempt=${attempt}; retrying attempt=${attempt + 1} in ${delayMs}ms: ${message}`
          );
          if (this.options.api_client.logWorkerEvent) {
            await this.options.api_client.logWorkerEvent("worker_retry_scheduled", {
              contract_id: job.contract_id,
              scheduled_for: job.scheduled_for,
              attempt,
              next_attempt: attempt + 1,
              next_eligible_at: nextJob.next_eligible_at,
              error: message
            });
          }
        } else {
          this.deadLetterJobs.push({
            contract_id: job.contract_id,
            scheduled_for: job.scheduled_for,
            attempt,
            error: message
          });
          this.log(`[worker] dead-letter contract=${job.contract_id} attempt=${attempt}: ${message}`);
          if (this.options.api_client.logWorkerEvent) {
            await this.options.api_client.logWorkerEvent("worker_dead_letter", {
              contract_id: job.contract_id,
              scheduled_for: job.scheduled_for,
              attempt,
              error: message
            });
          }
        }
      }

      job = await this.options.queue.dequeue();
    }
  }

  private log(message: string): void {
    this.options.logger?.(message);
  }
}

function normalizeAttempt(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 1;
  }

  return Math.max(1, Math.trunc(value));
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
