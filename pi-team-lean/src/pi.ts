import { spawn } from "node:child_process";

export interface PiResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export const runPi = async (
  prompt: string,
  cwd: string,
  model: string | undefined,
  onStdoutLine?: (line: string) => void,
): Promise<PiResult> => {
  const args = ["-p", "--no-session", "--mode", "text"];
  if (model) args.push("--model", model);

  return new Promise((resolve, reject) => {
    const proc = spawn("pi", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let buf = "";

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
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (onStdoutLine && buf) onStdoutLine(buf);
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
};
