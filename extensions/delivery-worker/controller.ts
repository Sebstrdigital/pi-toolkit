import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { run } from "../../scripts/delivery-agent.ts";
import type { Options } from "../../scripts/delivery-agent.ts";
import { WorkerProgress } from "../../scripts/worker-progress.ts";
import type { Progress } from "../../scripts/worker-progress.ts";

const safe = (action: () => void) => { try { action(); } catch { /* UI is not transport. */ } };

export function progressLines(role: string, p: Progress, width: number): string[] {
  const age = p.activityAgeSeconds === null ? "activity none" : `idle ${Math.floor(p.activityAgeSeconds)}s`;
  const tokens = p.usage === "reported" ? `tok ${p.tokens.totalTokens}` : `usage ${p.usage}`;
  const tools = p.tools.length
    ? `tools ${p.tools.length}:${p.tools.map(t => width >= 80 ? `${t.name}:${t.id}` : t.name).join(",")}`
    : p.phase;
  const failures = p.toolFailures ? ` | tool errors ${p.toolFailures}` : "";
  const terminal = !["running", "finalizing"].includes(p.state);
  return [
    `${role} ${p.state} ${Math.floor(p.elapsedSeconds)}s${failures} | ${terminal ? "acceptance/review pending" : tools}`,
    `${tokens} | ${age}`
      + (width >= 60 ? ` | compact ${p.compactionUsage === "reported" ? p.compactionTokens.totalTokens : p.compactionUsage}` : "")
      + (width >= 80 ? ` | in ${p.tokens.input} out ${p.tokens.output} cache ${p.tokens.cacheRead}/${p.tokens.cacheWrite}` : ""),
  ];
}

export class WorkerController {
  private active: { abort: AbortController; done: Promise<unknown> } | undefined;
  private clearWidget: (() => void) | undefined;
  private closing = false;
  private truncate: (text: string, width: number) => string;
  private launch: typeof run;
  constructor(truncate: (text: string, width: number) => string, launch: typeof run = run) {
    this.truncate = truncate;
    this.launch = launch;
  }
  async shutdown(): Promise<void> {
    this.closing = true;
    const owned = this.active;
    owned?.abort.abort();
    try { await owned?.done; } catch { /* Execution reports its own error. */ }
    finally {
      const clear = this.clearWidget;
      this.clearWidget = undefined;
      if (clear) safe(clear);
    }
  }
  async execute(params: Options, signal: AbortSignal | undefined, ctx: ExtensionToolContext) {
    if (this.closing) throw new Error("Delivery controller is shutting down");
    if (this.active) throw new Error("A delivery worker is already running");
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    const fallback = new WorkerProgress();
    let snapshot: Progress | undefined;
    let redraw = () => {};
    let disposed = false;
    // Own the deferred operation before calling any external UI code.
    const done = Promise.resolve().then(() => this.launch({ ...params, signal: abort.signal,
      onProgress: p => { snapshot = p; safe(redraw); },
    }));
    const owned = { abort, done };
    this.active = owned;
    try {
      if (ctx.mode === "tui") {
        if (this.clearWidget) safe(this.clearWidget);
        this.clearWidget = () => {
          disposed = true; redraw = () => {};
          safe(() => ctx.ui.setWidget("delivery-worker", undefined));
        };
        safe(() => ctx.ui.setWidget("delivery-worker", (tui, theme) => {
          redraw = () => { if (!disposed) safe(() => tui.requestRender()); };
          return {
            render: (width: number) => {
              try {
                const lines = snapshot ? progressLines(params.role, snapshot, width)
                  : [`${params.role} starting`, "usage pending | activity none"];
                return lines.map(line => this.truncate(theme.fg("muted", line), Math.max(0, width)));
              } catch { return []; }
            },
            invalidate() {}, // Theme colors are recomputed on every render.
            dispose() { disposed = true; redraw = () => {}; },
          };
        }, { placement: "aboveEditor" }));
      }
      const code = await done;
      return { content: [{ type: "text" as const,
        text: `Worker exit ${code}. Evidence: ${params.output}. Acceptance/review pending. task_accepted remains false; inspect status.json, report.md when present, and actual changes before continuing.` }],
        details: { exitCode: code, output: params.output, task_accepted: false }, isError: code !== 0 };
    } catch (error) {
      // Rejection may precede every callback, or follow a stale terminal snapshot.
      // Retain observed metadata, but never put transport error text in the widget.
      fallback.terminal("failed");
      const previous = snapshot ?? fallback.snapshot();
      snapshot = { ...previous, state: "failed", tools: [],
        usage: previous.usage === "pending" ? "unavailable" : previous.usage };
      safe(redraw);
      throw error;
    } finally {
      signal?.removeEventListener("abort", cancel);
      if (this.active === owned) this.active = undefined;
      // Terminal snapshot remains until next run/shutdown; launcher disposes timers.
    }
  }
}
