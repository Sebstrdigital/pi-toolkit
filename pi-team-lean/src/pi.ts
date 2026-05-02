import { spawn } from "node:child_process";

export interface PiResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut?: boolean;
}

export interface RunPiOptions {
  timeoutMs?: number;
}

const SIGKILL_GRACE_MS = 5000;

export const runPi = async (
  prompt: string,
  cwd: string,
  model: string | undefined,
  onStdoutLine?: (line: string) => void,
  options?: RunPiOptions,
): Promise<PiResult> => {
  const args = ["-p", "--no-session", "--mode", "text"];
  if (model) args.push("--model", model);

  return new Promise((resolve, reject) => {
    const proc = spawn("pi", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let buf = "";
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;
    let timeoutTimer: NodeJS.Timeout | undefined;

    if (options?.timeoutMs && options.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        stderr += `\n[pi-team-lean] worker exceeded timeout of ${options.timeoutMs}ms — sending SIGTERM\n`;
        if (onStdoutLine) onStdoutLine(`[timeout] SIGTERM after ${options.timeoutMs}ms`);
        proc.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (!proc.killed) {
            stderr += `[pi-team-lean] SIGTERM grace expired — sending SIGKILL\n`;
            proc.kill("SIGKILL");
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
      stderr += chunk.toString();
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
      const exitCode = code ?? (signal ? 124 : 0);
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
};
