export type WorkerTickHandler = (now: Date) => Promise<void> | void;

export class WorkerLoop {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly intervalMs: number,
    private readonly handler: WorkerTickHandler
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.handler(new Date());
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
  }
}