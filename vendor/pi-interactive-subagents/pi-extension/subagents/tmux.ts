/**
 * tmux surface layer — the only terminal multiplexer this extension supports.
 *
 * Everything the extension does to a pane goes through the small API in this
 * file: create/split a pane, type a command into it, read its screen, close
 * it, and poll for exit. Keeping the tmux calls isolated here means index.ts
 * stays testable without a multiplexer running.
 *
 * Panes are identified by tmux pane ids (e.g. `%12`). Worker panes live in
 * a private detached parking session, not the parent's window list. The
 * parent pane is captured when this runtime loads,
 * so reveal/hide never follows a worker's inherited `$TMUX_PANE` or the
 * user's current focus.
 */
import { execFile, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);

// ── Availability ──

const commandAvailability = new Map<string, boolean>();

function hasCommand(command: string): boolean {
  if (commandAvailability.has(command)) {
    return commandAvailability.get(command)!;
  }

  let available = false;
  try {
    execFileSync("sh", ["-c", `command -v ${command}`], { stdio: "ignore" });
    available = true;
  } catch {
    available = false;
  }

  commandAvailability.set(command, available);
  return available;
}

/**
 * True when running inside tmux with the tmux binary on PATH.
 * `TMUX` is set by tmux in every process it spawns (shell or pane).
 */
export function isTmuxAvailable(): boolean {
  return !!process.env.TMUX && hasCommand("tmux");
}

export function isMuxAvailable(): boolean {
  return isTmuxAvailable();
}

export function muxSetupHint(): string {
  return "Start pi inside tmux (`tmux new -A -s pi 'pi'`).";
}

function requireTmux(): void {
  if (!isTmuxAvailable()) {
    throw new Error(`tmux is required for subagents. ${muxSetupHint()}`);
  }
}

// ── Shell helpers ──

export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// ── Surface primitives ──

/** Parent ownership is fixed before any child inherits and changes TMUX_PANE. */
const PARENT_PANE = process.env.TMUX_PANE;

// Retain parking ownership across same-process module reloads, like surface ownership.
const PARKING_KEY = Symbol.for(`pi-toolkit/delivery-tmux/parking/${import.meta.url}`);
interface ParkingState {
  session?: string;
  anchor?: string;
  workers: Set<string>;
  closed: Set<string>;
  parentSize?: { surface: string; width: number; height: number; windowWidth: number; windowHeight: number };
}
const globals = globalThis as typeof globalThis & { [PARKING_KEY]?: ParkingState };
const parking = globals[PARKING_KEY] ??= { workers: new Set<string>(), closed: new Set<string>() };
parking.closed ??= new Set<string>(); // Retained earlier parking snapshots have no close markers.

function parentSession(): string {
  if (!PARENT_PANE) throw new Error("Parent tmux pane is unavailable; cannot manage worker detail safely");
  const session = execFileSync("tmux", ["display-message", "-p", "-t", PARENT_PANE, "#{session_id}"], { encoding: "utf8" }).trim();
  if (!session) throw new Error("Parent tmux session is unavailable; cannot manage worker detail safely");
  return session;
}

function parkingSession(): string {
  if (!parking.session) {
    // A keeper pane makes the last revealed worker hideable without restarting it.
    // Allocate a fresh name; never adopt another runtime's parking session.
    const output = execFileSync("tmux", ["new-session", "-d", "-s", `pi-workers-${randomUUID()}`,
      "-n", "parking", "-P", "-F", "#{session_id} #{pane_id}", "/bin/sh"], { encoding: "utf8" }).trim();
    const [session, anchor] = output.split(/\s+/);
    if (!session?.startsWith("$") || !anchor?.startsWith("%")) throw new Error(`Unexpected tmux new-session output: ${output}`);
    parking.session = session; parking.anchor = anchor;
  }
  return parking.session;
}

export function closeIdleParking(): void {
  if (parking.workers.size || !parking.anchor) return;
  // Close only our keeper pane, not a session that could contain other panes.
  execFileSync("tmux", ["kill-pane", "-t", parking.anchor], { encoding: "utf8" });
  parking.session = undefined; parking.anchor = undefined;
}

export function createSurface(name: string, _options?: { rebalance?: boolean }): string {
  requireTmux();
  parentSession(); // Prove the caller still exists before allocating resources.
  const safeName = `pi-worker-${name.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32) || "subagent"}`;
  try {
    const pane = execFileSync("tmux", ["new-window", "-d", "-t", parkingSession(), "-n", safeName, "-P", "-F", "#{pane_id}"], {
      encoding: "utf8",
    }).trim();
    if (!pane.startsWith("%")) throw new Error(`Unexpected tmux new-window output: ${pane}`);
    parking.workers.add(pane);
    return pane;
  } catch (error) {
    try { closeIdleParking(); } catch { /* Retain the owned anchor for retry. */ }
    throw error;
  }
}

function dimensions(format: string): number[] {
  const values = execFileSync("tmux", ["display-message", "-p", "-t", PARENT_PANE!, format], { encoding: "utf8" })
    .trim().split(/\s+/).map(Number);
  if (values.length !== format.split(" ").length || values.some(value => !Number.isFinite(value) || value <= 0)) throw new Error("Parent tmux pane geometry is unavailable");
  return values;
}

function restoreParentSize(): void {
  const size = parking.parentSize;
  if (!size) return;
  const [width, height] = dimensions("#{window_width} #{window_height}");
  // Restore only the caller's share; scale it if the user resized the window.
  execFileSync("tmux", ["resize-pane", "-t", PARENT_PANE!,
    "-x", String(Math.max(1, Math.round(size.width * width / size.windowWidth))),
    "-y", String(Math.max(1, Math.round(size.height * height / size.windowHeight)))], { encoding: "utf8" });
  parking.parentSize = undefined;
}

/** Move a detached owned worker beside the captured parent pane without restarting it. */
export function revealSurface(surface: string): void {
  requireTmux();
  if (!PARENT_PANE) throw new Error("Parent tmux pane is unavailable; cannot reveal worker detail safely");
  restoreParentSize(); // Retry a previous failed restore before another reveal.
  const [width, height, windowWidth, windowHeight] = dimensions("#{pane_width} #{pane_height} #{window_width} #{window_height}");
  execFileSync("tmux", ["join-pane", "-h", "-s", surface, "-t", PARENT_PANE], { encoding: "utf8" });
  parking.parentSize = { surface, width, height, windowWidth, windowHeight };
}

/** Focus is separate so a focus failure cannot lose ownership of a successful join. */
export function focusSurface(surface: string): void {
  requireTmux();
  execFileSync("tmux", ["select-pane", "-t", surface], { encoding: "utf8" });
}

export function focusParentSurface(): void {
  requireTmux();
  parentSession();
  restoreParentSize();
  execFileSync("tmux", ["select-pane", "-t", PARENT_PANE!], { encoding: "utf8" });
}

/** Park the shown worker outside the parent's session, preserving its pane and PID. */
export function hideSurface(surface: string): void {
  requireTmux();
  parentSession(); // prove the captured parent still exists before moving anything
  execFileSync("tmux", ["break-pane", "-d", "-s", surface, "-t", `${parkingSession()}:`], { encoding: "utf8" });
}

/**
 * Send a command string to a pane and execute it.
 * Typed literally (`-l`) so special characters are not interpreted as keys,
 * then submitted with Enter.
 */
export function sendCommand(surface: string, command: string): void {
  requireTmux();
  execFileSync("tmux", ["send-keys", "-t", surface, "-l", command], { encoding: "utf8" });
  execFileSync("tmux", ["send-keys", "-t", surface, "Enter"], { encoding: "utf8" });
}

/**
 * Send a long command to a pane by writing it to a script file first.
 * This avoids terminal line-wrapping issues that break commands exceeding the
 * pane's column width when sent character-by-character via sendCommand.
 *
 * By default the script is written to a temp directory, but callers can pass a
 * stable path (for example under session artifacts) so the exact invocation is
 * preserved for debugging.
 *
 * Returns the script path.
 */
export function sendLongCommand(
  surface: string,
  command: string,
  options?: { scriptPath?: string; scriptPreamble?: string },
): string {
  const scriptPath =
    options?.scriptPath ??
    join(
      tmpdir(),
      "pi-subagent-scripts",
      `cmd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.sh`,
    );
  mkdirSync(dirname(scriptPath), { recursive: true });

  const scriptParts = ["#!/bin/bash"];
  if (options?.scriptPreamble) {
    scriptParts.push(options.scriptPreamble.trimEnd());
  }
  scriptParts.push(command);

  writeFileSync(scriptPath, scriptParts.join("\n") + "\n", {
    mode: 0o755,
  });
  sendCommand(surface, `bash ${shellEscape(scriptPath)}`);
  return scriptPath;
}

/**
 * Read the screen contents of a pane (sync).
 */
export function readScreen(surface: string, lines = 50): string {
  requireTmux();
  return execFileSync(
    "tmux",
    ["capture-pane", "-p", "-t", surface, "-S", `-${Math.max(1, lines)}`],
    {
      encoding: "utf8",
    },
  );
}

/**
 * Read the screen contents of a pane (async).
 */
export async function readScreenAsync(surface: string, lines = 50): Promise<string> {
  requireTmux();
  const { stdout } = await execFileAsync(
    "tmux",
    ["capture-pane", "-p", "-t", surface, "-S", `-${Math.max(1, lines)}`],
    { encoding: "utf8" },
  );
  return stdout;
}

/**
 * Close a pane.
 */
export function closeSurface(surface: string, _options?: { rebalance?: boolean }): void {
  requireTmux();
  // Only successful kill-pane proves closure. A retained pre-parking owned pane
  // need not be registered in workers; absence from that Set is not evidence.
  if (!parking.closed.has(surface)) {
    execFileSync("tmux", ["kill-pane", "-t", surface], { encoding: "utf8" });
    parking.workers.delete(surface);
    parking.closed.add(surface);
  }
  if (parking.parentSize?.surface === surface) restoreParentSize();
  closeIdleParking();
  parking.closed.delete(surface);
}

// ── Exit polling ──

export interface PollResult {
  /** How the subagent exited */
  reason: "done" | "sentinel" | "error";
  /** Shell exit code (from sentinel). 0 for file-based exits. */
  exitCode: number;
  /** Error message if reason is "error" (auto-retry exhausted, provider overload, etc.) */
  errorMessage?: string;
}

/**
 * Interpret an `.exit` sidecar payload (written by the error path in
 * subagent-done.ts). Centralized so both the fast and slow paths in
 * pollForExit decode the payload the same way. Clean completions write no
 * sidecar and are detected via the terminal sentinel instead.
 *
 * Note: ask_question does NOT write a `.exit` sidecar — it keeps the session
 * open and signals the parent via a separate `.ask` file (see deliverPendingQuestion).
 */
function interpretExitSidecar(data: any): PollResult {
  if (data?.type === "error") {
    const errorMessage =
      typeof data.errorMessage === "string" && data.errorMessage.trim() !== ""
        ? data.errorMessage
        : "Subagent exited with stopReason=error (no errorMessage in sidecar).";
    return { reason: "error", exitCode: 1, errorMessage };
  }
  return { reason: "done", exitCode: 0 };
}

export const __pollForExitTest__ = { interpretExitSidecar };

/**
 * Poll until the subagent exits. Checks for a `.exit` sidecar file first
 * (written by the error path), falling back to the terminal sentinel for
 * clean-completion and crash detection.
 */
export async function pollForExit(
  surface: string,
  signal: AbortSignal,
  options: {
    interval: number;
    sessionFile?: string;
    sentinelFile?: string;
    onTick?: (elapsed: number) => void;
  },
): Promise<PollResult> {
  const start = Date.now();

  for (;;) {
    if (signal.aborted) {
      throw new Error("Aborted while waiting for subagent to finish");
    }

    // Fast path: check for .exit sidecar file (written by the error path)
    if (options.sessionFile) {
      try {
        const exitFile = `${options.sessionFile}.exit`;
        if (existsSync(exitFile)) {
          const data = JSON.parse(readFileSync(exitFile, "utf-8"));
          rmSync(exitFile, { force: true });
          return interpretExitSidecar(data);
        }
      } catch {}
    }

    // Check Claude sentinel file (written by plugin Stop hook)
    if (options.sentinelFile) {
      try {
        if (existsSync(options.sentinelFile)) {
          return { reason: "sentinel", exitCode: 0 };
        }
      } catch {}
    }

    // Slow path: read terminal screen for sentinel (crash detection)
    try {
      const screen = await readScreenAsync(surface, 5);
      const match = screen.match(/__SUBAGENT_DONE_(\d+)__/);
      if (match) {
        return { reason: "sentinel", exitCode: parseInt(match[1], 10) };
      }
    } catch {
      // Surface may have been destroyed — check if .exit file appeared in the meantime
      if (options.sessionFile) {
        try {
          const exitFile = `${options.sessionFile}.exit`;
          if (existsSync(exitFile)) {
            const data = JSON.parse(readFileSync(exitFile, "utf-8"));
            rmSync(exitFile, { force: true });
            return interpretExitSidecar(data);
          }
        } catch {}
      }
    }

    const elapsed = Math.floor((Date.now() - start) / 1000);
    options.onTick?.(elapsed);

    await new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error("Aborted"));
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, options.interval);
      function onAbort() {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      }
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
