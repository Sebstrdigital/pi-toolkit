import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";

export const MAX_RECORD_BYTES = 8 * 1024 * 1024;

// Byte framing avoids splitting Unicode separators and preserves split UTF-8.
export class EventFrames {
  private bytes = Buffer.alloc(0);
  private size = 0;
  private count = 0;
  private accept: (event: JsonAgentSessionEvent) => void;
  private limit: number;
  constructor(accept: (event: JsonAgentSessionEvent) => void, limit = MAX_RECORD_BYTES) {
    this.accept = accept;
    this.limit = limit;
  }
  push(chunk: Buffer): void {
    let start = 0;
    while (start < chunk.length) {
      const lf = chunk.indexOf(10, start);
      const end = lf < 0 ? chunk.length : lf;
      const part = chunk.subarray(start, end);
      const needed = this.size + part.length;
      if (needed > this.limit) throw new Error("Oversized JSONL record");
      if (needed > this.bytes.length) {
        const next = Buffer.allocUnsafe(Math.min(this.limit, Math.max(needed, 4096, this.bytes.length * 2)));
        this.bytes.copy(next, 0, 0, this.size);
        this.bytes = next;
      }
      part.copy(this.bytes, this.size);
      this.size = needed;
      if (lf < 0) break;
      const event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(this.bytes.subarray(0, this.size)));
      this.size = 0;
      if (!event || typeof event !== "object" || Array.isArray(event)
          || typeof event.type !== "string") throw new Error("Invalid JSONL event");
      if (++this.count === 1) {
        if (event.type !== "session") throw new Error("Missing session header");
      } else {
        if (event.type === "session") throw new Error("Unexpected session header");
        this.accept(event);
      }
      start = lf + 1;
    }
  }
  finish(): void {
    if (this.size) throw new Error("Unterminated JSONL record");
    if (!this.count) throw new Error("Missing session header");
  }
}

type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number };
const zero = (): Tokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 });
function usage(value: unknown): Tokens | undefined {
  if (!value || typeof value !== "object") return;
  const result = zero();
  for (const key of Object.keys(result) as (keyof Tokens)[]) {
    const n = (value as Tokens)[key];
    if (!Number.isFinite(n) || n < 0) return;
    result[key] = n;
  }
  return result;
}
function add(a: Tokens, b: Tokens): Tokens {
  const result = zero();
  for (const key of Object.keys(result) as (keyof Tokens)[]) result[key] = a[key] + b[key];
  return result;
}
export type Progress = {
  state: string; phase: string; elapsedSeconds: number; activityAgeSeconds: number | null;
  tools: { id: string; name: string }[]; tokens: Tokens; usage: "pending" | "reported" | "unavailable";
  compactionTokens: Tokens; compactionUsage: "pending" | "reported" | "unavailable";
  toolFailures: number;
};
// Only bounded allowlisted metadata reaches the compact display.
function label(value: unknown): string {
  return typeof value === "string" && /^[\w./:-]{1,80}$/.test(value) ? value : "unknown";
}
export class WorkerProgress {
  private clock: () => number;
  private started: number;
  private ended: number | undefined;
  private toolFailures = 0;
  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
    this.started = clock();
  }
  private activity: number | undefined;
  private state = "running";
  private phase = "starting";
  private tools = new Map<string, string>();
  private finalized = zero();
  private current = zero();
  private reported = false;
  private currentUsagePending = false;
  private compaction = zero();
  private compactionStatus: Progress["usage"] = "unavailable";
  observe(event: JsonAgentSessionEvent): void {
    if (this.ended !== undefined) return;
    this.activity = this.clock();
    if (event.type !== "agent_settled") this.state = "running";
    switch (event.type) {
      case "agent_start": case "turn_start": this.phase = "agent active"; break;
      case "message_start":
        if (event.message.role === "assistant") {
          this.current = zero(); this.currentUsagePending = true; this.phase = "responding";
        }
        break;
      case "message_update": {
        const u = usage(event.usage);
        // Pi streams initialized zero usage with deltas before provider usage arrives.
        // Only final messages can authoritatively report an all-zero response.
        if (u && Object.values(u).some(n => n > 0)) {
          this.current = u; this.reported = true; this.currentUsagePending = false;
        }
        const t = event.assistantMessageEvent.type;
        this.phase = t.startsWith("thinking") ? "thinking" : t.startsWith("toolcall") ? "tool call" : "responding";
        break;
      }
      case "message_end":
        if (event.message.role === "assistant") {
          const u = usage(event.message.usage);
          this.finalized = add(this.finalized, u ?? this.current);
          this.reported ||= !!u;
          if (u) this.currentUsagePending = false;
          this.current = zero();
        }
        break;
      case "tool_execution_start":
        // Keep exact identity internally. Reject pathological metadata instead of colliding or growing without bound.
        if (typeof event.toolCallId !== "string" || event.toolCallId.length > 4096
            || (!this.tools.has(event.toolCallId) && this.tools.size >= 256)) {
          throw new Error("Worker tool metadata limit exceeded");
        }
        this.tools.set(event.toolCallId, label(event.toolName)); this.phase = "tools active"; break;
      case "tool_execution_end":
        this.tools.delete(event.toolCallId);
        if (event.isError) this.toolFailures++;
        this.phase = this.tools.size ? "tools active" : "tool finished"; break;
      case "compaction_start": this.phase = "compacting"; this.compactionStatus = "pending"; break;
      case "compaction_end": {
        const u = usage(event.result?.usage);
        if (u) this.compaction = add(this.compaction, u);
        this.compactionStatus = u ? "reported" : "unavailable";
        this.phase = "compaction finished"; break;
      }
      case "auto_retry_start": case "summarization_retry_scheduled": this.phase = "retry waiting"; break;
      case "auto_retry_end": case "summarization_retry_finished": this.phase = "retry finished"; break;
      case "summarization_retry_attempt_start": this.phase = "summarization retry"; break;
      case "agent_settled": this.state = "finalizing"; this.phase = "settled"; break;
    }
  }
  terminal(state: string): void {
    if (this.ended !== undefined) return;
    this.ended = this.clock(); this.state = state; this.tools.clear();
  }
  snapshot(): Progress {
    const now = this.ended ?? this.clock();
    return { state: this.state, phase: this.phase, elapsedSeconds: (now - this.started) / 1000,
      activityAgeSeconds: this.activity === undefined ? null : (now - this.activity) / 1000,
      tools: [...this.tools].map(([id, name]) => ({ id: label(id), name })), toolFailures: this.toolFailures,
      tokens: add(this.finalized, this.current),
      usage: this.reported && !this.currentUsagePending ? "reported"
        : this.state === "running" || this.state === "finalizing" ? "pending" : "unavailable",
      compactionTokens: { ...this.compaction }, compactionUsage: this.compactionStatus };
  }
}
export function progressText(p: Progress): string {
  const tokens = p.usage === "reported"
    ? `${p.tokens.totalTokens} tokens (in ${p.tokens.input}, out ${p.tokens.output}, cache read ${p.tokens.cacheRead}, write ${p.tokens.cacheWrite})`
    : `usage ${p.usage}`;
  return `Worker ${p.state} | ${Math.floor(p.elapsedSeconds)}s | ${p.phase}`
    + (p.tools.length ? ` | ${p.tools.map(t => `${t.name}:${t.id}`).join(", ")}` : "")
    + (p.toolFailures ? ` | observed tool failures ${p.toolFailures}` : "")
    + (p.state === "completed" ? " | acceptance/review pending" : "")
    + ` | ${tokens} | compaction ${p.compactionUsage === "reported" ? p.compactionTokens.totalTokens + " tokens" : p.compactionUsage}`
    + ` | ${p.activityAgeSeconds === null ? "no activity observed" : `last activity ${Math.floor(p.activityAgeSeconds)}s ago`}`;
}
