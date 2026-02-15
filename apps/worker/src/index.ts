import { WorkerLoop } from "./loop";
import { createRunQueueFromEnv } from "./queue-factory";
import { createWorkerApiClientFromEnv } from "./api-client";
import { WorkerRuntime } from "./runtime";
import { DeterministicScheduler } from "./scheduler";
import { loadEnvironment } from "./load-env";

loadEnvironment(import.meta.url);

validateWorkerEnv();

const intervalMs = Number.parseInt(process.env.WORKER_TICK_MS ?? "30000", 10);
const appTimezone = process.env.APP_TZ ?? "UTC";
const enableDemoSchedule = parseBoolean(process.env.WORKER_ENABLE_DEMO_SCHEDULE ?? "false");

const scheduler = new DeterministicScheduler();
const queue = createRunQueueFromEnv();
const apiClient = createWorkerApiClientFromEnv();
const runtime = new WorkerRuntime({
  api_client: apiClient,
  scheduler,
  queue,
  logger: (message) => console.log(message)
});

if (enableDemoSchedule) {
  scheduler.registerContract(
    process.env.WORKER_DEMO_CONTRACT_ID ?? "demo_contract",
    process.env.WORKER_DEMO_CRON ?? "*/5 * * * *",
    appTimezone,
    new Date()
  );
}

const loop = new WorkerLoop(intervalMs, (now) => runtime.tick(now));

loop.start();

process.on("SIGINT", () => {
  loop.stop();
  void queue.close().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  loop.stop();
  void queue.close().finally(() => process.exit(0));
});

function parseBoolean(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function validateWorkerEnv(): void {
  const apiBaseUrl = process.env.WORKER_API_BASE_URL;
  if (!apiBaseUrl) {
    process.stderr.write("[env] WORKER_API_BASE_URL is not set - using default http://localhost:4000\n");
  }

  const queueDriver = (process.env.WORKER_QUEUE_DRIVER ?? "").toLowerCase();
  if (queueDriver === "redis" && !process.env.REDIS_URL) {
    process.stderr.write("[env] WORKER_QUEUE_DRIVER=redis but REDIS_URL is missing. Worker will fail to start queue.\n");
  }
}
