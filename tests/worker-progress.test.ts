import assert from "node:assert/strict";
import { test } from "node:test";
import { EventFrames, WorkerProgress, progressText } from "../scripts/worker-progress.ts";

const record = (event: object) => Buffer.from(JSON.stringify(event) + "\r\n");
const u = (n: number) => ({ input: n, output: n * 2, cacheRead: n * 3, cacheWrite: n * 4, totalTokens: n * 10 });
const observe = (p: WorkerProgress, event: any) => p.observe(event);

test("one-byte framing preserves CRLF, UTF-8 and Unicode separators with bounded storage", () => {
  const events: any[] = [];
  const frames = new EventFrames(e => events.push(e));
  const event = { type: "unknown", text: "é🙂\u2028\u2029", padding: "a".repeat(100_000) };
  const bytes = Buffer.concat([record({ type: "session" }), record(event)]);
  for (const byte of bytes) frames.push(Buffer.from([byte]));
  frames.finish();
  assert.deepEqual(events, [event]);
  assert.ok((frames as any).bytes.length <= 262144);
  assert.equal((frames as any).parts, undefined, "No retained fragment references");
});

test("framing fails closed for missing/duplicate headers, invalid UTF-8, malformed, oversized and trailing fragments", () => {
  for (const bytes of [
    Buffer.from(""), record({ type: "agent_start" }), Buffer.from("null\n"), Buffer.from("[]\n"),
    Buffer.from('{"type":"session"}\n{bad}\n'),
    Buffer.concat([record({ type: "session" }), record({ type: "session" })]),
    Buffer.concat([record({ type: "session" }), Buffer.from([0xff, 10])]),
    Buffer.concat([record({ type: "session" }), Buffer.from(" ")]),
    Buffer.concat([record({ type: "session" }), Buffer.from("\r")]),
    Buffer.concat([record({ type: "session" }), Buffer.from("\n")]),
    Buffer.concat([record({ type: "session" }), Buffer.from('{"type":"agent_start"}')]),
  ]) {
    const frames = new EventFrames(() => {});
    assert.throws(() => { frames.push(bytes); frames.finish(); });
  }
  const frames = new EventFrames(() => {}, 64);
  frames.push(record({ type: "session" }));
  assert.throws(() => frames.push(Buffer.alloc(65, 32)), /Oversized/);
});

test("elapsed and activity age tick during silence and freeze idempotently on termination", () => {
  let now = 1000;
  const p = new WorkerProgress(() => now);
  assert.equal(p.snapshot().activityAgeSeconds, null);
  observe(p, { type: "agent_start" });
  now = 4000;
  assert.equal(p.snapshot().elapsedSeconds, 3);
  assert.equal(p.snapshot().activityAgeSeconds, 3);
  observe(p, { type: "agent_settled" });
  assert.equal(p.snapshot().state, "finalizing");
  now = 5000;
  p.terminal("completed");
  const end = p.snapshot();
  now = 10000;
  p.terminal("failed");
  observe(p, { type: "turn_start" });
  assert.deepEqual(p.snapshot(), end);
  assert.match(progressText(end), /acceptance\/review pending/);
});

test("usage snapshots replace, finalized usage reconciles, retries recover, turn/agent events do not double count", () => {
  const p = new WorkerProgress();
  assert.equal(p.snapshot().usage, "pending");
  observe(p, { type: "message_start", message: { role: "assistant" } });
  const update = (n: number) => observe(p, { type: "message_update", usage: u(n), assistantMessageEvent: { type: "thinking_delta", delta: "SECRET" } });
  update(1); update(2);
  assert.deepEqual(p.snapshot().tokens, u(2));
  observe(p, { type: "message_update", usage: { ...u(99), output: -1 }, assistantMessageEvent: { type: "text_delta" } });
  assert.deepEqual(p.snapshot().tokens, u(2));
  observe(p, { type: "message_end", message: { role: "assistant", usage: u(3), stopReason: "error" } });
  observe(p, { type: "auto_retry_start", errorMessage: "SECRET" });
  assert.equal(p.snapshot().phase, "retry waiting");
  observe(p, { type: "auto_retry_end" });
  observe(p, { type: "message_start", message: { role: "assistant" } });
  update(4);
  assert.deepEqual(p.snapshot().tokens, u(7));
  observe(p, { type: "message_end", message: { role: "assistant", usage: u(5) } });
  observe(p, { type: "turn_end", message: { usage: u(5) } });
  observe(p, { type: "agent_end", messages: [{ usage: u(5) }] });
  assert.deepEqual(p.snapshot().tokens, u(8));
  observe(p, { type: "compaction_start" });
  assert.equal(p.snapshot().compactionUsage, "pending");
  observe(p, { type: "compaction_end", result: { usage: u(9), summary: "SECRET" } });
  assert.deepEqual(p.snapshot().compactionTokens, u(9));
  assert.deepEqual(p.snapshot().tokens, u(8));
  assert.ok(!progressText(p.snapshot()).includes("SECRET"));
  observe(p, { type: "message_start", message: { role: "assistant" } });
  update(1);
  observe(p, { type: "message_end", message: { role: "assistant" } });
  assert.deepEqual(p.snapshot().tokens, u(9), "Fallback to last reported usage if final usage is unavailable");
  observe(p, { type: "compaction_start" });
  observe(p, { type: "compaction_end" });
  assert.equal(p.snapshot().compactionUsage, "unavailable");
  assert.deepEqual(p.snapshot().compactionTokens, u(9));
  const unavailable = new WorkerProgress();
  unavailable.terminal("failed");
  assert.equal(unavailable.snapshot().usage, "unavailable");
});

test("default live zeros and invalid usage stay pending, then nonzero usage recovers", () => {
  const p = new WorkerProgress();
  observe(p, { type: "message_start", message: { role: "assistant" } });
  const update = (usage: unknown, type = "text_delta") => observe(p, {
    type: "message_update", usage, assistantMessageEvent: { type },
  });
  update(u(0));
  update(u(0), "thinking_delta");
  for (const invalid of [undefined, {}, { ...u(1), input: -1 }, { ...u(1), output: NaN }, { ...u(1), totalTokens: Infinity }]) {
    update(invalid);
    assert.equal(p.snapshot().usage, "pending");
    assert.deepEqual(p.snapshot().tokens, u(0));
    assert.match(progressText(p.snapshot()), /usage pending/);
    assert.doesNotMatch(progressText(p.snapshot()), /\b0 tokens/);
  }
  update(u(2));
  assert.equal(p.snapshot().usage, "reported");
  assert.deepEqual(p.snapshot().tokens, u(2));
  update(u(0));
  update({ ...u(99), cacheRead: -1 });
  assert.deepEqual(p.snapshot().tokens, u(2), "Unconfirmed or invalid updates do not erase known usage");
  observe(p, { type: "message_end", message: { role: "assistant", usage: u(0) } });
  assert.equal(p.snapshot().usage, "reported");
  assert.deepEqual(p.snapshot().tokens, u(0), "Authoritative final zero replaces provisional nonzero");
  assert.match(progressText(p.snapshot()), /0 tokens/);
});

test("new response and retry defaults preserve finalized totals without claiming current usage", () => {
  const p = new WorkerProgress();
  const start = () => observe(p, { type: "message_start", message: { role: "assistant" } });
  const update = (n: number) => observe(p, {
    type: "message_update", usage: u(n), assistantMessageEvent: { type: "text_delta" },
  });
  const end = (usage: unknown) => observe(p, { type: "message_end", message: { role: "assistant", usage } });
  start(); update(2); end(u(3));
  for (const retry of [false, true]) {
    if (retry) {
      observe(p, { type: "auto_retry_start" });
      observe(p, { type: "auto_retry_end" });
    }
    start(); update(0);
    assert.equal(p.snapshot().usage, "pending");
    assert.deepEqual(p.snapshot().tokens, u(3));
    assert.match(progressText(p.snapshot()), /usage pending/);
    if (!retry) {
      end(u(0));
    } else {
      update(4);
      assert.equal(p.snapshot().usage, "reported");
      assert.deepEqual(p.snapshot().tokens, u(7));
      end(u(0));
    }
    observe(p, { type: "turn_end", message: { role: "assistant", usage: u(3) } });
    observe(p, { type: "agent_end", messages: [{ role: "assistant", usage: u(3) }] });
    assert.equal(p.snapshot().usage, "reported");
    assert.deepEqual(p.snapshot().tokens, u(3), "Final zero adds nothing; event copies are not counted");
  }
  const unknown = new WorkerProgress();
  observe(unknown, { type: "message_start", message: { role: "assistant" } });
  observe(unknown, { type: "message_update", usage: u(0), assistantMessageEvent: { type: "text_delta" } });
  observe(unknown, { type: "message_end", message: { role: "assistant", usage: { ...u(0), output: -1 } } });
  assert.equal(unknown.snapshot().usage, "pending", "Invalid final usage does not confirm default zeros");
  unknown.terminal("completed");
  assert.equal(unknown.snapshot().usage, "unavailable");
});

test("concurrent tool identity is exact, failures visible without terminal failure, metadata bounded", () => {
  const p = new WorkerProgress();
  for (const id of ["id a", "id b"]) observe(p, { type: "tool_execution_start", toolCallId: id, toolName: "read", args: "SECRET" });
  assert.equal(p.snapshot().tools.length, 2);
  observe(p, { type: "tool_execution_end", toolCallId: "id a", isError: true, result: "SECRET ERROR" });
  assert.equal(p.snapshot().tools.length, 1);
  assert.equal(p.snapshot().toolFailures, 1);
  assert.equal(p.snapshot().state, "running");
  assert.match(progressText(p.snapshot()), /observed tool failures 1/);
  assert.ok(!progressText(p.snapshot()).includes("SECRET"));
  observe(p, { type: "tool_execution_end", toolCallId: "id b", isError: false });
  assert.equal(p.snapshot().tools.length, 0);
  for (let i = 0; i < 256; i++) observe(p, { type: "tool_execution_start", toolCallId: String(i), toolName: "read" });
  assert.throws(() => observe(p, { type: "tool_execution_start", toolCallId: "overflow", toolName: "read" }), /metadata limit/);
  assert.throws(() => observe(new WorkerProgress(), { type: "tool_execution_start", toolCallId: "x".repeat(4097) }), /metadata limit/);
});
