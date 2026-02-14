import { WorkerLoop } from "./loop";
import { InMemoryRunQueue } from "./queue";
import { DeterministicScheduler } from "./scheduler";

const intervalMs = Number.parseInt(process.env.WORKER_TICK_MS ?? "30000", 10);
const appTimezone = process.env.APP_TZ ?? "UTC";

const scheduler = new DeterministicScheduler();
const queue = new InMemoryRunQueue();

scheduler.registerContract(
  process.env.WORKER_DEMO_CONTRACT_ID ?? "demo_contract",
  process.env.WORKER_DEMO_CRON ?? "*/5 * * * *",
  appTimezone,
  new Date()
);

const loop = new WorkerLoop(intervalMs, (now) => {
  const dueJobs = scheduler.collectDueJobs(now);

  for (const job of dueJobs) {
    queue.enqueue(job);
  }

  let job = queue.dequeue();
  while (job) {
    // Placeholder dispatch for run execution wiring.
    console.log(`[worker] dispatch contract=${job.contract_id} scheduled_for=${job.scheduled_for}`);
    job = queue.dequeue();
  }
});

loop.start();

process.on("SIGINT", () => {
  loop.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  loop.stop();
  process.exit(0);
});