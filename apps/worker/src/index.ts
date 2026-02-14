import { WorkerLoop } from "./loop";
import { createRunQueueFromEnv } from "./queue-factory";
import { DeterministicScheduler } from "./scheduler";
import { loadEnvironment } from "./load-env";

loadEnvironment(import.meta.url);

const intervalMs = Number.parseInt(process.env.WORKER_TICK_MS ?? "30000", 10);
const appTimezone = process.env.APP_TZ ?? "UTC";
const enableDemoSchedule = parseBoolean(process.env.WORKER_ENABLE_DEMO_SCHEDULE ?? "false");

const scheduler = new DeterministicScheduler();
const queue = createRunQueueFromEnv();

if (enableDemoSchedule) {
  scheduler.registerContract(
    process.env.WORKER_DEMO_CONTRACT_ID ?? "demo_contract",
    process.env.WORKER_DEMO_CRON ?? "*/5 * * * *",
    appTimezone,
    new Date()
  );
}

const loop = new WorkerLoop(intervalMs, (now) => {
  return processTick(now);
});

async function processTick(now: Date): Promise<void> {
  const dueJobs = scheduler.collectDueJobs(now);

  for (const job of dueJobs) {
    await queue.enqueue(job);
  }

  let job = await queue.dequeue();
  while (job) {
    // Placeholder dispatch for run execution wiring.
    console.log(`[worker] dispatch contract=${job.contract_id} scheduled_for=${job.scheduled_for}`);
    job = await queue.dequeue();
  }
}

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
