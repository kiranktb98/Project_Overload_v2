import { WorkerLoop } from "./loop";

const intervalMs = Number.parseInt(process.env.WORKER_TICK_MS ?? "30000", 10);

const loop = new WorkerLoop(intervalMs, (now) => {
  // Placeholder tick until scheduler is wired.
  console.log(`[worker] tick ${now.toISOString()}`);
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