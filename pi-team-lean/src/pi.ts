import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { allowListedEnv } from "./env.js";

/**
 * B3: hard cap on accumulated stdout/stderr per Pi invocation.
 * A looping/chatty agent can emit gigabytes; this keeps the Line process from
 * OOM-ing. We keep the TAIL (most recent output) because that is what the
 * harness inspects for failures / feedback. 4 MB per stream is generous for any
 * legitimate Pi run while still bounding memory to ~8 MB per active child.
 */
export const OUTPUT_CAP_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Append `text` to `acc`, trimming the head when the result exceeds
 * OUTPUT_CAP_BYTES so the tail (most recent output) is always preserved.
 * Exported for unit testing only.
 */
export const appendCapped = (acc: string, text: string): string => {
  const next = acc + text;
  if (next.length <= OUTPUT_CAP_BYTES) return next;
  // Keep most-recent OUTPUT_CAP_BYTES characters.
  return next.slice(next.length - OUTPUT_CAP_BYTES);
};

export interface PiResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export interface RunPiOptions {
  timeoutMs?: number;
}

/** Default wall-clock cap for gate pis (reviewer / scenario-judge), in ms. */
export const DEFAULT_GATE_TIMEOUT_MS = 10 * 60 * 1000;

const SIGKILL_GRACE_MS = 5000;

/**
 * Signal an entire process group when possible (the child is spawned
 * `detached`, so its pid is also its process-group id). Killing the group
 * reaps grandchildren — the pi binary shells out to compilers / git / the model
 * client, and SIGTERM-ing only the direct child orphaned those on timeout.
 * Falls back to a direct child signal if the group send fails.
 */
const signalTree = (proc: ReturnType<typeof spawn>, sig: NodeJS.Signals): void => {
  if (proc.pid !== undefined) {
    try {
      process.kill(-proc.pid, sig);
      return;
    } catch {
      /* group already gone — fall through to direct kill */
    }
  }
  try {
    proc.kill(sig);
  } catch {
    /* ignore */
  }
};

/**
 * B4: Track every active Pi child so the SIGTERM handler can reap them on
 * Foreman / systemctl stop. The set is module-level; the handler is registered
 * once (guarded by the flag below).
 */
const activeProcs: Set<ReturnType<typeof spawn>> = new Set();
let sigtermHandlerInstalled = false;

const installSigtermHandler = (): void => {
  if (sigtermHandlerInstalled) return;
  sigtermHandlerInstalled = true;
  process.on("SIGTERM", () => {
    // Kill every in-flight Pi process group, then exit with the conventional
    // SIGTERM exit code (128 + 15 = 143) so the process manager sees a clean
    // signal-induced shutdown rather than an unhandled exception.
    for (const p of activeProcs) {
      signalTree(p, "SIGTERM");
    }
    process.exit(143);
  });
};

/** Testing only — exposes the active-proc set size for assertions. */
export const __activeProcsSize = (): number => activeProcs.size;

/**
 * Tier-0 worker-home confinement — redirects $HOME for the prompt-injectable
 * worker/reviewer pi to a minimal home (only pi config/auth + git identity
 * symlinked) so its ~/-relative credential/config lookups (ssh keys, cloud creds,
 * shell history, other dotfile secrets) resolve there instead of the factory
 * user's real home. NOTE: a HOME redirect, NOT a filesystem jail — the pi still
 * runs as the factory user and can read absolute paths it has permission for
 * (other projects' repos, etc.). General FS confinement = Tier 1 (container, future).
 *
 * Pure helper: injectable `env` + `exists` fn so unit tests can exercise all 3
 * cases without touching the real filesystem or spawning pi.
 *
 * Returns the minimal HOME to use, or `undefined` to keep the inherited HOME.
 * Defensive fallback: if PI_WORKER_HOME is set but the dir does NOT exist, return
 * undefined (never brick every run due to a misconfigured path). The caller
 * (runPi) is responsible for emitting the stderr warning in that case.
 */
export const workerHomeOverride = (
  env: NodeJS.ProcessEnv = process.env,
  exists: (p: string) => boolean = existsSync,
): string | undefined => {
  const val = env.PI_WORKER_HOME;
  if (!val) return undefined;
  if (exists(val)) return val;
  return undefined;
};

export const runPi = async (
  prompt: string,
  cwd: string,
  model: string | undefined,
  onStdoutLine?: (line: string) => void,
  options?: RunPiOptions,
  onStderrLine?: (line: string) => void,
): Promise<PiResult> => {
  installSigtermHandler();
  const args = ["-p", "--no-session", "--mode", "text"];
  if (model) args.push("--model", model);

  // Tier-0 worker-home confinement: redirect HOME to the minimal worker home so
  // the prompt-injectable worker/reviewer pi's ~/-relative credential lookups (ssh
  // keys, cloud creds, dotfile secrets) don't resolve into the factory user's real
  // home. NOT a filesystem jail (absolute-path reads still work as the factory
  // user) — that's Tier 1. Falls back to inherited HOME with a stderr warning if
  // the configured dir is missing, so a misconfiguration never silently bricks runs.
  const spawnEnv = allowListedEnv();
  const overrideHome = workerHomeOverride();
  if (overrideHome) {
    spawnEnv.HOME = overrideHome;
  } else if (process.env.PI_WORKER_HOME) {
    process.stderr.write(
      `[pi-team-lean] PI_WORKER_HOME=${process.env.PI_WORKER_HOME} does not exist — falling back to inherited HOME\n`,
    );
  }

  return new Promise((resolve, reject) => {
    // detached so the child leads its own process group → we can SIGTERM/SIGKILL
    // the whole tree on timeout instead of orphaning grandchildren.
    //
    // Untrusted-agent boundary (this is where B1's secret containment belongs):
    // worker/reviewer/qa-author Pi roles are prompt-injectable and never need the
    // factory's GitHub token or other secrets (the harness does all git + tests).
    // Spawn them with an allow-listed env — pi reads its model auth from
    // $HOME/.pi/agent/auth.json (HOME is allow-listed; Tier-0 confinement above
    // points HOME at the minimal worker home), so this drops the token while
    // keeping the toolchain. The HARNESS process keeps the token for its own git.
    const proc = spawn("pi", args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: true, env: spawnEnv });
    activeProcs.add(proc);
    let stdout = "";
    let stderr = "";
    let buf = "";
    let errBuf = "";
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    if (options?.timeoutMs && options.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        stderr += `\n[pi-team-lean] worker exceeded timeout of ${options.timeoutMs}ms — sending SIGTERM\n`;
        if (onStdoutLine) onStdoutLine(`[timeout] SIGTERM after ${options.timeoutMs}ms`);
        signalTree(proc, "SIGTERM");
        killTimer = setTimeout(() => {
          if (!proc.killed) {
            stderr += `[pi-team-lean] SIGTERM grace expired — sending SIGKILL\n`;
            signalTree(proc, "SIGKILL");
          }
        }, SIGKILL_GRACE_MS);
      }, options.timeoutMs);
    }

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout = appendCapped(stdout, text);
      if (onStdoutLine) {
        buf += text;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) onStdoutLine(line);
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = appendCapped(stderr, text);
      if (onStderrLine) {
        errBuf += text;
        const lines = errBuf.split("\n");
        errBuf = lines.pop() ?? "";
        for (const line of lines) onStderrLine(line);
      }
    });
    proc.on("error", (err) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      activeProcs.delete(proc);
      reject(err);
    });
    proc.on("close", (code, signal) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      activeProcs.delete(proc);
      if (onStdoutLine && buf) onStdoutLine(buf);
      if (onStderrLine && errBuf) onStderrLine(errBuf);
      const exitCode = code ?? (signal ? 124 : 0);
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
};
