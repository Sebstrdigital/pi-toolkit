import assert from "node:assert/strict";
import { test } from "node:test";
import { ExecutionDeadline, type DeadlineClock } from "../vendor/pi-interactive-subagents/pi-extension/subagents/execution-deadline.ts";
import { chargeExecution, remainingExecutionMs } from "../extensions/delivery-tmux/allowance.ts";

function fixtureClock() {
  let now = 0, next = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const clock: DeadlineClock = {
    now: () => now,
    setTimeout(callback, ms) { const id = ++next; timers.set(id, { at: now + ms, callback }); return id; },
    clearTimeout(handle) { timers.delete(handle as number); },
  };
  return { clock, timers, advance(ms: number) {
    const end = now + ms;
    for (;;) {
      const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      now = entry[1].at; timers.delete(entry[0]); entry[1].callback();
    }
    now = end;
  } };
}

test("execution clock excludes question waiting and pause, never rearms a fresh allowance", () => {
  const f = fixtureClock(); let expired = 0;
  const lease = new ExecutionDeadline(30000, () => expired++, f.clock);
  f.advance(10000); lease.transition("waiting");
  f.advance(24 * 3600000); assert.equal(expired, 0); assert.equal(lease.elapsedMs, 10000);
  lease.transition("paused"); f.advance(3600000); assert.equal(lease.remainingMs, 20000);
  lease.transition("running"); f.advance(19999); assert.equal(expired, 0);
  f.advance(1); assert.equal(expired, 1); assert.equal(lease.remainingMs, 0);
  lease.transition("waiting"); lease.transition("running"); f.advance(1000); assert.equal(expired, 1);
  lease.close(); lease.close(); assert.equal(f.timers.size, 0);
});

test("undeclared work has no arbitrary cutoff but still measures execution", () => {
  const f = fixtureClock(); let expired = 0;
  const deadline = new ExecutionDeadline(Infinity, () => expired++, f.clock);
  assert.equal(f.timers.size, 0);
  f.advance(6 * 3600000); assert.equal(expired, 0);
  assert.equal(deadline.elapsedMs, 6 * 3600000);
  deadline.transition("waiting"); f.advance(3600000);
  assert.equal(deadline.elapsedMs, 6 * 3600000);
  deadline.transition("running"); f.advance(1000);
  assert.equal(deadline.close(), 6 * 3600000 + 1000);
  assert.equal(f.timers.size, 0);
});

test("declared grant can exceed 20 minutes; oversized Node timers are chunked safely", () => {
  const f = fixtureClock(); let expired = 0;
  const lease = new ExecutionDeadline(60 * 60000, () => expired++, f.clock);
  f.advance(20 * 60000); assert.equal(expired, 0); assert.equal(lease.remainingMs, 40 * 60000);
  f.advance(40 * 60000); assert.equal(expired, 1); lease.close();
  const long = new ExecutionDeadline(2 ** 31 + 5000, () => expired++, f.clock);
  f.advance(2 ** 31 - 1); assert.equal(expired, 1);
  f.advance(5001); assert.equal(expired, 2); long.close();
  assert.throws(() => new ExecutionDeadline(0, () => {}, f.clock), /exhausted/);
});

test("terminal continuation and replacement share cumulative persisted execution", () => {
  let original = { name: "original", assignmentRoot: "task", executionMs: 0, runExecutionMs: 0 };
  original = chargeExecution(original, 5 * 60000);
  assert.equal(remainingExecutionMs("task", 30, [original]), 25 * 60000);
  // Saved same-task continuation resets only the run counter, not task consumption.
  original = chargeExecution({ ...original, runExecutionMs: 0 }, 2 * 60000);
  const replacement = chargeExecution({ name: "replacement", assignmentRoot: "task", executionMs: 0, runExecutionMs: 0 }, 3 * 60000);
  const records = JSON.parse(JSON.stringify([original, replacement]));
  assert.equal(remainingExecutionMs("task", 30, records, { name: "replacement", remainingEffortMinutes: 12 }), 9 * 60000);
  assert.throws(() => remainingExecutionMs("task", 10, [original, replacement, { name: "unrelated", assignmentRoot: "other" }]), /exhausted/);
});

test("unmeasured, regressed or exhausted execution fails closed", () => {
  assert.throws(() => remainingExecutionMs("task", 30, [{ name: "legacy", assignmentRoot: "task" }]), /unmeasured/);
  const record = { name: "original", assignmentRoot: "task", executionMs: 500, runExecutionMs: 500 };
  assert.throws(() => chargeExecution(record, 499), /regressed/);
  assert.throws(() => chargeExecution(record, NaN), /invalid/);
  assert.throws(() => remainingExecutionMs("task", 500 / 60000, [record]), /exhausted/);
  assert.deepEqual(chargeExecution(record, 500), record, "Repeated checkpoint does not double charge");
});

// Accounting fixture, not an LLM compliance or source-repair demonstration.
test("ordinary corrections and reconciled checkpoints consume one cumulative allowance", () => {
  let record = { name: "builder", assignmentRoot: "approved", executionMs: 0, runExecutionMs: 0 };
  for (const event of ["test-pump-correction", "review-ownership-defect", "terminal-checkpoint"]) {
    record = chargeExecution({ ...record, runExecutionMs: 0 }, 60000);
    assert.ok(remainingExecutionMs("approved", 5, [record]) > 0, event);
  }
  assert.equal(record.executionMs, 180000);
  assert.throws(() => remainingExecutionMs("approved", 3, [record]), /exhausted/);
});
