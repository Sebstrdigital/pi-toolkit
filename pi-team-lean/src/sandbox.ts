/**
 * sandbox.ts — run the LLM-authored acceptance script under the least authority
 * we can give it, with a pre-exec content gate.
 *
 * Threat model (qa-script-arbitrary-exec): the qa-author pi is fed the story
 * body + worker diff verbatim, so its bash output is UNTRUSTED — a
 * prompt-injection payload in a story body can make it emit `rm -rf ~`,
 * `git push`, or an exfil curl. Previously that script was chmod+exec'd in the
 * live repo with the operator's full `process.env`. This module closes that
 * path with two layers:
 *
 *   1. A static **content gate** (`screenAcceptanceScript`) that rejects the
 *      script before it ever runs if it contains obviously dangerous
 *      constructs (recursive force-remove of broad paths, any `git push`,
 *      network egress, sudo, fork-bombs, writes outside the workspace…).
 *
 *   2. An **isolated execution** layer (`runSandboxed`) that runs the script in
 *      whatever isolation the host provides. When a container runtime
 *      (`podman`/`docker`) is available it runs inside `--network=none`, a
 *      read-only image, the repo bind-mounted, dropped capabilities and a
 *      non-root user. When no runtime is present it falls back to a restricted
 *      shell with an explicit allow-listed env (no inherited secrets) — strictly
 *      better than the previous full-env host exec, and the content gate still
 *      applies. The chosen mode is reported so the caller can record it.
 *
 * Network isolation + RO-rootfs + dropped caps is the real boundary; the content
 * gate is defence-in-depth and a fast, auditable fail-closed for the common
 * payloads. Neither is claimed to be a complete jail on a host without a
 * container runtime — the chosen mode is reported via the `mode` field so the
 * operator can see whether real (container) or best-effort (restricted-shell)
 * isolation was applied for a given run.
 */

import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { allowListedEnv } from "./env.js";

export interface ScreenResult {
  ok: boolean;
  /** Human-readable reason the script was rejected (only when `ok` is false). */
  reason?: string;
  /** The specific offending line, for the artifact / event. */
  offendingLine?: string;
}

/**
 * Patterns that must never appear in an acceptance script. Deliberately
 * conservative and string/regex based: the script is generated to assert
 * behaviour of code already under test, so it has no legitimate need to push
 * git, reach the network, escalate privilege, or recursively force-delete broad
 * paths.
 */
const DENY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*r[a-zA-Z]*f|\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*f[a-zA-Z]*r/, reason: "recursive force-remove (rm -rf)" },
  { re: /\bgit\s+push\b/, reason: "git push" },
  { re: /\bgit\s+remote\s+(add|set-url)\b/, reason: "git remote mutation" },
  { re: /\b(curl|wget|nc|ncat|netcat|telnet|ssh|scp|sftp|rsync)\b/, reason: "network egress tool" },
  { re: /\bsudo\b|\bsu\s+-|\bdoas\b/, reason: "privilege escalation" },
  { re: /\b(shutdown|reboot|halt|poweroff|mkfs|dd\s+if=)/, reason: "host/disk control" },
  { re: /\bchmod\s+(-R\s+)?[0-7]*7[0-7]{2}\s+\//, reason: "world-writable on absolute path" },
  { re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, reason: "fork bomb" },
  { re: /\b(npm|pnpm|yarn|pip|pip3|gem|cargo|go)\s+(install|i|add|publish)\b/, reason: "package install/publish (network + supply chain)" },
  { re: />\s*\/(etc|usr|bin|sbin|boot|dev|sys|proc)\b/, reason: "write to a system path" },
  { re: /\beval\s+["'`]?\$\(|\bbase64\s+(-d|--decode)\b/, reason: "obfuscated/dynamic execution" },
];

/**
 * Static pre-exec gate over the generated acceptance script. Returns
 * `{ ok: false, reason }` on the first dangerous construct found.
 */
export const screenAcceptanceScript = (script: string): ScreenResult => {
  const lines = script.split("\n");
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, ""); // ignore comments
    if (!line.trim()) continue;
    for (const { re, reason } of DENY_PATTERNS) {
      if (re.test(line)) {
        return { ok: false, reason, offendingLine: raw.trim().slice(0, 200) };
      }
    }
  }
  return { ok: true };
};

export type SandboxMode = "container" | "restricted-shell";

export interface SandboxResult {
  ok: boolean;
  output: string;
  /** True if the content gate rejected the script (never executed). */
  rejected: boolean;
  rejectReason?: string;
  /** How the script was actually run (only meaningful when `rejected` is false). */
  mode: SandboxMode;
  timedOut: boolean;
}

let cachedRuntime: "podman" | "docker" | null | undefined;

/** Detect a usable container runtime once. */
const detectRuntime = (): "podman" | "docker" | null => {
  if (cachedRuntime !== undefined) return cachedRuntime;
  for (const rt of ["podman", "docker"] as const) {
    try {
      execFileSync(rt, ["--version"], { stdio: ["ignore", "ignore", "ignore"] });
      cachedRuntime = rt;
      return rt;
    } catch {
      /* try next */
    }
  }
  cachedRuntime = null;
  return null;
};

/** Override the runtime detection (tests / explicit opt-out). */
export const __setRuntimeForTest = (rt: "podman" | "docker" | null | undefined): void => {
  cachedRuntime = rt;
};

const DEFAULT_SANDBOX_IMAGE = "docker.io/library/bash:5";

export interface RunSandboxedOpts {
  /** Absolute path to the script file to execute (must live inside `cwd`). */
  scriptPath: string;
  /** Workspace root — bind-mounted into the container / used as shell cwd. */
  cwd: string;
  timeoutMs: number;
  /** Container image to run the script in. Defaults to a bare bash image. */
  image?: string;
  /** Force a mode (tests). When unset, auto-detects a container runtime. */
  forceMode?: SandboxMode;
}

const runViaShell = (scriptPath: string, cwd: string, timeoutMs: number): { ok: boolean; output: string; timedOut: boolean } => {
  try {
    const output = execFileSync("bash", [scriptPath], {
      cwd,
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      // No inherited secrets: explicit allow-list only.
      env: allowListedEnv(),
    });
    return { ok: true, output, timedOut: false };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; signal?: string; code?: string };
    const out = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
    const timedOut = err.signal === "SIGTERM" || err.code === "ETIMEDOUT";
    return { ok: false, output: out, timedOut };
  }
};

const runViaContainer = (
  runtime: "podman" | "docker",
  scriptPath: string,
  cwd: string,
  image: string,
  timeoutMs: number,
): { ok: boolean; output: string; timedOut: boolean } => {
  const scriptName = basename(scriptPath);
  // Workspace bind-mounted read-write at /work (the acceptance script may need
  // to compile scratch files); network disabled; root fs read-only; all caps
  // dropped; non-root user. The script must live inside cwd so it is visible at
  // /work/<name> — guaranteed by the caller (acceptDir is under repoCwd).
  const rel = scriptPath.startsWith(cwd) ? scriptPath.slice(cwd.length).replace(/^\/+/, "") : scriptName;
  const args = [
    "run",
    "--rm",
    "--network=none",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--user=1000:1000",
    "--tmpfs=/tmp:rw,exec",
    "-v",
    `${cwd}:/work:rw`,
    "-w",
    "/work",
    image,
    "bash",
    `/work/${rel}`,
  ];
  try {
    const output = execFileSync(runtime, args, {
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      env: allowListedEnv(),
    });
    return { ok: true, output, timedOut: false };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; signal?: string; code?: string };
    const out = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
    const timedOut = err.signal === "SIGTERM" || err.code === "ETIMEDOUT";
    return { ok: false, output: out, timedOut };
  }
};

/**
 * Screen, then run the acceptance script under isolation. Returns a structured
 * result; never throws. The content gate runs first and fails closed.
 */
export const runSandboxed = (script: string, opts: RunSandboxedOpts): SandboxResult => {
  const screen = screenAcceptanceScript(script);
  if (!screen.ok) {
    return {
      ok: false,
      rejected: true,
      rejectReason: `${screen.reason}${screen.offendingLine ? `: ${screen.offendingLine}` : ""}`,
      output: `[sandbox] acceptance script REJECTED by content gate — ${screen.reason}\n  ${screen.offendingLine ?? ""}`,
      mode: "restricted-shell",
      timedOut: false,
    };
  }

  const runtime = opts.forceMode === "restricted-shell" ? null : detectRuntime();
  if (runtime && opts.forceMode !== "restricted-shell") {
    const r = runViaContainer(runtime, opts.scriptPath, opts.cwd, opts.image ?? DEFAULT_SANDBOX_IMAGE, opts.timeoutMs);
    return { ok: r.ok, output: r.output, rejected: false, mode: "container", timedOut: r.timedOut };
  }
  const r = runViaShell(opts.scriptPath, opts.cwd, opts.timeoutMs);
  return { ok: r.ok, output: r.output, rejected: false, mode: "restricted-shell", timedOut: r.timedOut };
};
