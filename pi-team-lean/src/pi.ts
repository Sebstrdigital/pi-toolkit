import { spawn } from "node:child_process";
import { allowListedEnv } from "./env.js";

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

export const runPi = async (
  prompt: string,
  cwd: string,
  model: string | undefined,
  onStdoutLine?: (line: string) => void,
  options?: RunPiOptions,
  onStderrLine?: (line: string) => void,
): Promise<PiResult> => {
  const args = ["-p", "--no-session", "--mode", "text"];
  if (model) args.push("--model", model);

  return new Promise((resolve, reject) => {
    // detached so the child leads its own process group → we can SIGTERM/SIGKILL
    // the whole tree on timeout instead of orphaning grandchildren.
    //
    // Untrusted-agent boundary (this is where B1's secret containment belongs):
    // worker/reviewer/qa-author Pi roles are prompt-injectable and never need the
    // factory's GitHub token or other secrets (the harness does all git + tests).
    // Spawn them with an allow-listed env — pi reads its model auth from
    // ~/.pi/agent/auth.json (HOME is allow-listed), so this drops the token while
    // keeping the toolchain. The HARNESS process keeps the token for its own git.
    const proc = spawn("pi", args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: true, env: allowListedEnv() });
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
      stdout += text;
      if (onStdoutLine) {
        buf += text;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) onStdoutLine(line);
      }
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
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
      reject(err);
    });
    proc.on("close", (code, signal) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (onStdoutLine && buf) onStdoutLine(buf);
      if (onStderrLine && errBuf) onStderrLine(errBuf);
      const exitCode = code ?? (signal ? 124 : 0);
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
};
