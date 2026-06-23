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

/**
 * ADR 0011 — fail-closed worker sandbox. Thrown when a sandbox-enabled worker
 * spawn cannot START its sandbox (the `podman run` binary is missing, or podman
 * itself refuses to launch the container: bad flags, missing network, missing
 * image — podman exit 125/126/127 / ENOENT). This is structurally DIFFERENT from
 * "the worker ran inside the sandbox and exited non-zero" (a code failure routed
 * through the normal retry/valfix loop). The harness MUST catch this and PARK the
 * card as an infra failure (ADR 0008 path) rather than ever falling back to an
 * unsandboxed `spawn("pi", …)`. Never re-run unsandboxed on this error.
 */
export class SandboxLaunchError extends Error {
  constructor(
    message: string,
    /** Best-effort stderr tail from the failed podman launch, for the park comment. */
    public readonly detail: string = "",
  ) {
    super(message);
    this.name = "SandboxLaunchError";
  }
}

/**
 * podman exit codes that mean *podman / the container runtime* failed to launch
 * the workload, NOT that the workload (pi) ran and exited non-zero:
 *   125 — podman itself failed (bad flag, missing image, missing/again network)
 *   126 — the container command was found but could not be invoked
 *   127 — the container command was not found
 * Any OTHER non-zero exit is the worker's own exit code (it ran inside the
 * sandbox) and must route through the normal worker-failure path.
 */
export const SANDBOX_LAUNCH_EXIT_CODES = new Set<number>([125, 126, 127]);

/** True when an exit code from the podman child means the SANDBOX failed to start. */
export const isSandboxLaunchFailureExit = (code: number | null): boolean =>
  code !== null && SANDBOX_LAUNCH_EXIT_CODES.has(code);

/**
 * ADR 0011 — env vars the PARENT `podman` CLI needs to reach the rootless host
 * podman socket (sibling-container launch). These locate the socket; without them
 * the `podman run` itself can't connect and every sandboxed run fail-closes to a
 * park. They are passed to the PARENT podman process ONLY — never into the worker
 * container's `-e` list (buildSandboxPodmanArgs), which would hand the prompt-
 * injectable worker the socket location and re-open the escape surface this sandbox
 * exists to close.
 */
export const PODMAN_SOCKET_ENV_VARS = ["CONTAINER_HOST", "DOCKER_HOST", "XDG_RUNTIME_DIR"] as const;

/**
 * Build the env for the PARENT `podman` process in the sandboxed branch: the
 * allow-listed base (drops the factory's secrets — the parent podman needs none)
 * PLUS the socket-locating vars from `source` when set, so the rootless CLI can
 * find /run/podman/podman.sock. Pure + injectable for testing.
 */
export const sandboxParentEnv = (
  base: NodeJS.ProcessEnv,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv => {
  const out: NodeJS.ProcessEnv = { ...base };
  for (const key of PODMAN_SOCKET_ENV_VARS) {
    const v = source[key];
    if (v !== undefined) out[key] = v;
  }
  return out;
};

/**
 * ADR 0011 — build the locked-down `podman run` argv for a sandboxed worker pi.
 *
 * PURE + exported so the exact authority granted to the worker container is
 * unit-reviewable without spawning anything. The returned argv is what we hand to
 * `spawn("podman", argv, …)`; the podman child IS the pi process from the
 * harness's point of view (stdin/stdout/timeout/exit semantics are preserved by
 * the caller).
 *
 * Authority granted (and ONLY this):
 *   - the worktree (`cwd`) bind-mounted READ-WRITE (the worker writes its diff there)
 *   - `$PI_WORKER_HOME` bind-mounted READ-ONLY (model auth.json; never writable so
 *     the worker can't corrupt the factory subscription)
 *   - `--network <internal net>` — a podman `--internal` network with NO external
 *     egress; the worker reaches its model provider ONLY via the egress proxy below
 *   - HTTP(S)_PROXY pointed at the egress proxy; NO_PROXY empty so EVERY request is
 *     forced through the proxy (which allowlists only the provider host)
 *   - HOME=$PI_WORKER_HOME and PI_SKILLS_DIR so pi finds its auth + skills
 *
 * NEVER granted (verified by the unit tests): the podman socket, /etc/factory, the
 * board token, .ssh, any sibling worktree, --privileged, DOCKER_HOST/CONTAINER_HOST.
 */
export const buildSandboxPodmanArgs = (input: {
  cwd: string;
  piArgs: string[];
  env?: NodeJS.ProcessEnv;
}): string[] => {
  const env = input.env ?? process.env;
  const image = env.PI_SANDBOX_IMAGE || "localhost/dua-factory-foreman:latest";
  const network = env.PI_SANDBOX_NETWORK || "pi-sandbox-net";
  const proxy = env.PI_SANDBOX_PROXY ?? "";
  const workerHome = env.PI_WORKER_HOME;
  const skillsDir = env.PI_SKILLS_DIR;

  const args: string[] = [
    "run",
    "--rm",
    "-i", // keep stdin open so the harness can pipe the prompt to pi's stdin
    "--network",
    network,
    "-v",
    `${input.cwd}:${input.cwd}:rw`,
  ];
  // Worker home is bind-mounted read-only (model auth). It is host==in-container
  // path on the box, so a single -v with identical src:dst works.
  if (workerHome) {
    args.push("-v", `${workerHome}:${workerHome}:ro`, "-e", `HOME=${workerHome}`);
  }
  args.push("-w", input.cwd);
  // Egress: force ALL traffic through the allowlisting proxy. NO_PROXY empty.
  args.push(
    "-e",
    `HTTPS_PROXY=${proxy}`,
    "-e",
    `HTTP_PROXY=${proxy}`,
    "-e",
    "NO_PROXY=",
  );
  if (skillsDir) {
    args.push("-e", `PI_SKILLS_DIR=${skillsDir}`);
  }
  args.push(image, "pi", ...input.piArgs);
  return args;
};

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
    // ADR 0011 — fail-closed worker sandbox. When PI_SANDBOX=1 (set by the foreman
    // for a sandbox-enabled project), the worker pi runs inside a locked-down podman
    // sibling container instead of directly on the host. We spawn `podman run …` —
    // the podman child IS the pi process from this harness's view, so the stdin pipe,
    // stdout line streaming, timeout, detached process-group kill and PiResult
    // semantics below are IDENTICAL. `process.env` is read directly (not the
    // allow-listed spawnEnv) because PI_SANDBOX* are sandbox-control vars, not worker
    // env. The podman child's own env is locked down by buildSandboxPodmanArgs.
    const sandboxed = process.env.PI_SANDBOX === "1";
    // PARENT-process env. Non-sandbox: the allow-listed worker env (unchanged). Sandbox:
    // the parent is the `podman` CLI, which needs the socket-locating vars (CONTAINER_HOST
    // / XDG_RUNTIME_DIR / DOCKER_HOST) to reach the rootless host socket — added ONLY to
    // the parent, NEVER to the worker container's -e list (recursion/socket-escape guard).
    const parentEnv = sandboxed ? sandboxParentEnv(spawnEnv) : spawnEnv;
    const proc = sandboxed
      ? spawn("podman", buildSandboxPodmanArgs({ cwd, piArgs: args, env: process.env }), {
          cwd,
          stdio: ["pipe", "pipe", "pipe"],
          detached: true,
          env: parentEnv,
        })
      : spawn("pi", args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: true, env: parentEnv });
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
      // ADR 0011 fail-closed: when sandboxed, a spawn error (e.g. ENOENT — the
      // `podman` binary is missing) means the SANDBOX could not start. Surface it
      // as a SandboxLaunchError so the harness parks (infra) and NEVER falls back
      // to an unsandboxed worker. Non-sandbox path is unchanged.
      if (sandboxed) {
        reject(new SandboxLaunchError(`worker sandbox failed to launch: ${err.message}`, stderr));
        return;
      }
      reject(err);
    });
    proc.on("close", (code, signal) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      activeProcs.delete(proc);
      if (onStdoutLine && buf) onStdoutLine(buf);
      if (onStderrLine && errBuf) onStderrLine(errBuf);
      const exitCode = code ?? (signal ? 124 : 0);
      // ADR 0011 fail-closed: when sandboxed and NOT timed out, a podman launch
      // exit code (125/126/127 — podman itself refused: bad flags, missing
      // network/image, cannot exec) means the sandbox never started the worker.
      // Park as infra rather than treating it as a worker code-failure (which would
      // feed valfix or, worse, suggest a re-run). A timed-out run is a genuine
      // worker that hung inside the sandbox → keep the normal timeout semantics.
      if (sandboxed && !timedOut && isSandboxLaunchFailureExit(code)) {
        reject(
          new SandboxLaunchError(
            `worker sandbox failed to launch: podman exited ${exitCode}`,
            stderr,
          ),
        );
        return;
      }
      resolve({ exitCode, stdout, stderr, timedOut });
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
};
