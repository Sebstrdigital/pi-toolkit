export type ExecutionState = "running" | "waiting" | "paused";
export interface DeadlineClock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
const systemClock: DeadlineClock = {
  now: () => performance.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Execution elapsed time, not CPU/model effort. Waiting and pause retain ownership. */
export class ExecutionDeadline {
  private used = 0;
  private since: number;
  private state: ExecutionState = "running";
  private timer: unknown;
  private closed = false;
  private expired = false;

  readonly allowanceMs: number;
  private expire: () => void;
  private clock: DeadlineClock;
  constructor(allowanceMs: number, expire: () => void, clock: DeadlineClock = systemClock) {
    if ((allowanceMs !== Infinity && !Number.isFinite(allowanceMs)) || allowanceMs <= 0) throw new Error("Execution allowance exhausted or invalid");
    this.allowanceMs = allowanceMs;
    this.expire = expire;
    this.clock = clock;
    this.since = clock.now();
    this.arm();
  }
  get elapsedMs(): number {
    return this.used + (!this.closed && this.state === "running" ? Math.max(0, this.clock.now() - this.since) : 0);
  }
  get remainingMs(): number { return Math.max(0, this.allowanceMs - this.elapsedMs); }
  transition(state: ExecutionState): boolean {
    if (this.closed || state === this.state) return false;
    this.used = this.elapsedMs;
    this.since = this.clock.now();
    this.state = state;
    this.arm();
    return true;
  }
  close(): number {
    if (!this.closed) {
      this.used = this.elapsedMs;
      this.closed = true;
      this.clock.clearTimeout(this.timer);
    }
    return this.used;
  }
  private arm(): void {
    this.clock.clearTimeout(this.timer);
    if (this.closed || this.expired || this.state !== "running" || this.allowanceMs === Infinity) return;
    // Node truncates oversized timers to 1ms; long grants need bounded chunks.
    this.timer = this.clock.setTimeout(() => {
      if (this.closed || this.state !== "running") return;
      if (this.remainingMs > 0) { this.arm(); return; }
      this.expired = true;
      this.expire();
    }, Math.min(2 ** 31 - 1, this.remainingMs));
  }
}
