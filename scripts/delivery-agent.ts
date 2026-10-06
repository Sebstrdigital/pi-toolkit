import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import {
  mkdir, open, readFile, realpath, stat, writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { EventFrames, WorkerProgress, progressText } from "./worker-progress.ts";
import type { Progress } from "./worker-progress.ts";

export type Role = "builder" | "reviewer";

export type Options = {
  role: Role;
  project: string;
  packet: string;
  output: string;
  timeout?: number;
  piCommand?: string[];
  onProgress?: (progress: Progress) => void;
  signal?: AbortSignal;
};

type Message = {
  role?: string;
  stopReason?: string;
  content?: Array<{ type: string; text?: string }>;
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const tools = {
  builder: "read,grep,find,ls,bash,edit,write",
  reviewer: "read,grep,find,ls",
};

export function command(
  role: Role,
  roleText: string,
  piCommand: string[] = ["pi"],
): string[] {
  return [
    ...piCommand,
    "--mode", "json",
    "--no-session",
    "--no-approve",
    "--no-extensions",
    "--no-mcp",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--offline",
    "--tools", tools[role],
    "--append-system-prompt", roleText,
  ];
}

// Split only on LF. Unicode separators inside JSON strings are not framing.
export async function extractReport(path: string): Promise<string> {
  const frames = new EventFrames(event => {
    consume(event);
  });
  let count = 0;
  let settled = false;
  let last: Message | undefined;

  function consume(event: any): void {
      count++;
      if (!event || typeof event !== "object"
          || Array.isArray(event) || typeof event.type !== "string") {
        throw new Error(`Invalid event at line ${count}`);
      }

      if (event.type === "session") {
        throw new Error("Unexpected additional session header");
      }
      if ([
        "agent_start", "agent_end", "turn_start", "turn_end",
        "message_start", "message_update", "message_end",
        "tool_execution_start", "tool_execution_update", "tool_execution_end",
        "compaction_start", "compaction_end", "auto_retry_start", "auto_retry_end",
        "summarization_retry_scheduled", "summarization_retry_attempt_start",
        "summarization_retry_finished",
      ].includes(event.type)) {
        settled = false;
      }
      if (event.type === "agent_start") last = undefined;
      if (event.type === "message_end") {
        if (!event.message || typeof event.message !== "object"
            || Array.isArray(event.message)) {
          throw new Error("Invalid completed message");
        }
        if (event.message.role === "assistant") last = event.message;
      }
      if (event.type === "agent_settled") settled = true;
  }
  for await (const chunk of createReadStream(path)) frames.push(chunk as Buffer);
  frames.finish();
  if (!count || !settled || !last) {
    throw new Error("Missing header, settled event, or assistant report");
  }
  if (last.stopReason !== "stop") {
    throw new Error(`Assistant did not finish normally: ${last.stopReason}`);
  }
  if (!Array.isArray(last.content)
      || last.content.some(block => !block || typeof block !== "object")) {
    throw new Error("Invalid assistant content");
  }
  if (last.content.some(block => block.type === "toolCall")) {
    throw new Error("Final report still contains tool calls");
  }
  const text = last.content
    .filter(block => block.type === "text" && typeof block.text === "string")
    .map(block => block.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Empty assistant report");
  return `${text}\n`;
}

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

export async function run(options: Options): Promise<number> {
  const { role } = options;
  const timeout = options.timeout ?? 1800;
  if (!Object.hasOwn(tools, role)) throw new Error("Unknown role");
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2_000_000) {
    throw new Error("Timeout must be between 0 and 2,000,000 seconds");
  }
  if (process.platform === "win32") {
    throw new Error("This launcher requires macOS or Linux");
  }
  const project = await realpath(options.project);
  const packet = await realpath(options.packet);
  const output = resolve(options.output);
  if (!(await stat(project)).isDirectory()) {
    throw new Error("Project must be a directory");
  }
  const packetText = await readFile(packet, "utf8");
  if (!packetText.trim()) throw new Error("Task packet is empty");
  const roleText = await readFile(resolve(root, "agents", `${role}.md`), "utf8");
  const argv = command(role, roleText, options.piCommand);
  if (!argv[0]) throw new Error("Missing pi executable");

  // Requires an existing parent; refuses any existing output path.
  await mkdir(output, { mode: 0o700 });
  const status: Record<string, unknown> = {
    status: "running",
    role,
    project,
    packet_source: packet,
    timeout_seconds: timeout,
    command: argv,
    task_accepted: false,
  };
  const saveStatus = () => writeFile(
    resolve(output, "status.json"),
    `${JSON.stringify(status, null, 2)}\n`,
  );
  const progress = new WorkerProgress();
  const publishTerminal = (state: string) => {
    progress.terminal(state);
    try { options.onProgress?.(progress.snapshot()); }
    catch { /* Display failures never change the launcher outcome. */ }
  };
  try { await saveStatus(); }
  catch (error) {
    publishTerminal("failed");
    throw error;
  }

  const handles: Awaited<ReturnType<typeof open>>[] = [];
  let exit = 1;
  try {
    await writeFile(resolve(output, "packet.md"), packetText);
    await writeFile(resolve(output, "role.md"), roleText);
    const events = await open(resolve(output, "events.jsonl"), "wx");
    handles.push(events);
    const errors = await open(resolve(output, "stderr.log"), "wx");
    handles.push(errors);

    const child = spawn(argv[0], argv.slice(1), {
      cwd: project,
      stdio: ["pipe", "pipe", errors.fd],
      detached: true,
    });
    let spawnError: Error | undefined;
    let inputError: Error | undefined;
    let streamError: unknown;
    let evidenceError = false;
    let cancellation: "timed_out" | "interrupted" | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    child.on("error", error => { spawnError = error; });
    child.stdin?.on("error", error => { inputError = error; });

    const closed = new Promise<void>(done => {
      child.once("close", (code, signal) => {
        status.process_exit_code = code;
        status.process_signal = signal;
        done();
      });
    });
    const cancel = (reason: "timed_out" | "interrupted") => {
      if (cancellation) return;
      cancellation = reason;
      if (child.pid) {
        signalGroup(child.pid, "SIGTERM");
        killTimer = setTimeout(() => {
          if (child.pid) signalGroup(child.pid, "SIGKILL");
        }, 2000);
      }
    };
    const fail = (error: unknown) => {
      streamError ??= error;
      // Protocol/write failures are failures, not user interruption.
      cancel("interrupted");
    };
    let lastNotification = -Infinity;
    const notify = (force = false) => {
      if (!options.onProgress || (!force && performance.now() - lastNotification < 250)) return;
      lastNotification = performance.now();
      try { options.onProgress(progress.snapshot()); } catch { /* Rendering is not transport. */ }
    };
    const frames = new EventFrames(event => { progress.observe(event); notify(); });
    const capture = (async () => {
      try {
        for await (const chunk of child.stdout!) {
          // Await each write: bounded pipe memory and filesystem backpressure.
          if (!evidenceError) {
            try { await events.writeFile(chunk); }
            catch (error) { evidenceError = true; fail(error); }
          }
          if (!streamError) {
            try { frames.push(chunk as Buffer); } catch (error) { fail(error); }
          }
        }
        // A cancelled process need not finish its current record (or emit a header).
        if (!streamError && !cancellation) frames.finish();
      } catch (error) { fail(error); }
    })();
    const interrupt = () => cancel("interrupted");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    const timer = setTimeout(() => cancel("timed_out"), timeout * 1000);
    const ticks = setInterval(() => notify(), 1000);
    options.signal?.addEventListener("abort", interrupt, { once: true });

    try {
      notify();
      if (options.signal?.aborted) interrupt();
      child.stdin?.end(packetText);
      await Promise.all([closed, capture]);
    } finally {
      clearTimeout(timer);
      clearInterval(ticks);
      options.signal?.removeEventListener("abort", interrupt);
      if (killTimer) clearTimeout(killTimer);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      // Also stop same-group descendants if the leader exited on SIGTERM.
      if (cancellation && child.pid) signalGroup(child.pid, "SIGKILL");
    }

    if (streamError) throw streamError;
    if (cancellation) {
      status.status = cancellation;
      status.error = cancellation === "timed_out"
        ? "Worker timeout" : "Worker interrupted";
      exit = cancellation === "timed_out" ? 124 : 130;
    } else {
      if (spawnError) throw spawnError;
      if (inputError) throw inputError;
      if (status.process_exit_code !== 0) {
        throw new Error(`Worker exited with ${status.process_exit_code}`);
      }
      const report = await extractReport(resolve(output, "events.jsonl"));
      await writeFile(resolve(output, "report.md"), report);
      status.status = "completed";
      exit = 0;
    }
  } catch (error) {
    status.status = "failed";
    status.error = error instanceof Error ? error.message : String(error);
  } finally {
    const closures = await Promise.allSettled(handles.map(handle => handle.close()));
    const failedClose = closures.find(result => result.status === "rejected");
    if (failedClose?.status === "rejected") {
      status.status = "failed";
      status.error = String(failedClose.reason);
      exit = 1;
    }
    // Do not freeze or announce completion until all required evidence is saved.
    try { await saveStatus(); }
    catch (error) {
      publishTerminal("failed");
      throw error;
    }
    publishTerminal(String(status.status));
  }
  return exit;
}

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      project: { type: "string" },
      packet: { type: "string" },
      output: { type: "string" },
      timeout: { type: "string", default: "1800" },
    },
  });
  const role = positionals[0];
  if (positionals.length !== 1 || !["builder", "reviewer"].includes(role)
      || !values.project || !values.packet || !values.output) {
    throw new Error(
      "Usage: node scripts/delivery-agent.ts builder|reviewer"
      + " --project PATH --packet PATH --output PATH [--timeout SECONDS]",
    );
  }
  // Broken stderr is a display failure, including asynchronous EPIPE.
  let outputBroken = false;
  process.stderr.on("error", () => { outputBroken = true; });
  let last = -Infinity;
  return run({
    onProgress: progress => {
      if (performance.now() - last >= 1000 || !["running", "finalizing"].includes(progress.state)) {
        if (!outputBroken) process.stderr.write(`${role}: ${progressText(progress)}\n`);
        last = performance.now();
      }
    },
    role: role as Role,
    project: values.project,
    packet: values.packet,
    output: values.output,
    timeout: Number(values.timeout),
  });
}

if (process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
