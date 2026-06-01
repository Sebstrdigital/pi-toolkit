/**
 * robust-b.test.ts — tests for Cluster B hardening items.
 *
 * B1: story.test_command is never passed to the worker prompt or runTestCommand.
 * B2: acceptance script is written inside storyCwd, not repoCwd, so it is reachable
 *     inside the container mount (-v storyCwd:/work).
 * B3: pi.ts output cap — appendCapped keeps the tail and never exceeds OUTPUT_CAP_BYTES.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendCapped, OUTPUT_CAP_BYTES } from "../src/pi.js";
import type { Sprint } from "../src/types.js";

// ─── B3: output cap unit tests ────────────────────────────────────────────────

describe("B3 appendCapped", () => {
  it("returns unchanged string when under cap", () => {
    expect(appendCapped("hello", " world")).toBe("hello world");
  });

  it("keeps the tail when concatenation exceeds OUTPUT_CAP_BYTES", () => {
    const cap = OUTPUT_CAP_BYTES;
    // Build an acc that is already at the cap, then append 100 more bytes.
    const acc = "A".repeat(cap);
    const extra = "B".repeat(100);
    const result = appendCapped(acc, extra);
    // Must not exceed cap.
    expect(result.length).toBe(cap);
    // The tail (most recent output) must be preserved.
    expect(result.endsWith(extra)).toBe(true);
    // The head is trimmed.
    expect(result.startsWith("A")).toBe(true);
  });

  it("OUTPUT_CAP_BYTES is defined and reasonable (>= 1 MB, <= 16 MB)", () => {
    expect(OUTPUT_CAP_BYTES).toBeGreaterThanOrEqual(1 * 1024 * 1024);
    expect(OUTPUT_CAP_BYTES).toBeLessThanOrEqual(16 * 1024 * 1024);
  });
});

// ─── B1 + B2: integration via runSprint ───────────────────────────────────────

const piCalls = vi.hoisted(() => {
  const prompts: string[] = [];
  return { prompts };
});

vi.mock("../src/pi.js", async (importOriginal) => {
  // Re-export non-runPi exports (appendCapped, OUTPUT_CAP_BYTES, etc.) unchanged.
  const orig = await importOriginal<typeof import("../src/pi.js")>();
  return {
    ...orig,
    runPi: async (prompt: string, cwd: string) => {
      const { execFileSync: execGit } = await import("node:child_process");
      piCalls.prompts.push(prompt);
      const callIndex = piCalls.prompts.length - 1;
      if (callIndex === 0) {
        // worker call — make a commit
        execGit("sh", ["-c", "printf 'b1\\n' >> b1.txt && git add b1.txt && git commit -m b1"], {
          cwd,
          encoding: "utf8",
        });
        return { exitCode: 0, stdout: "worker committed", stderr: "", timedOut: false };
      }
      // qa-author call — return a trivial passing acceptance script
      return { exitCode: 0, stdout: "#!/bin/sh\nexit 0\n", stderr: "", timedOut: false };
    },
  };
});

vi.mock("../src/sandbox.js", async () => {
  const { execFileSync: execBash } = await import("node:child_process");
  return {
    runSandboxed: (_script: string, opts: { scriptPath: string; cwd: string; timeoutMs?: number }) => {
      // Verify B2: the script must live inside opts.cwd (the storyCwd).
      if (!opts.scriptPath.startsWith(opts.cwd)) {
        return {
          ok: false,
          rejected: true,
          rejectReason: `B2-FAIL: scriptPath ${opts.scriptPath} is outside cwd ${opts.cwd}`,
          output: "",
          mode: "restricted-shell",
          timedOut: false,
        };
      }
      try {
        const output = execBash("bash", [opts.scriptPath], {
          cwd: opts.cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: opts.timeoutMs,
        });
        return { ok: true, output, rejected: false, mode: "restricted-shell", timedOut: false };
      } catch (e: unknown) {
        const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; signal?: string; code?: string };
        const output = (err.stdout?.toString() ?? "") + (err.stderr?.toString() ?? "");
        const timedOut = err.signal === "SIGTERM" || err.code === "ETIMEDOUT";
        return { ok: false, output, rejected: false, mode: "restricted-shell", timedOut };
      }
    },
  };
});

const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const initRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "ptl-robust-b-"));
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@t.t"], dir);
  git(["config", "user.name", "t"], dir);
  writeFileSync(join(dir, ".gitignore"), ".pi-team-lean/\n");
  writeFileSync(join(dir, "base.txt"), "base\n");
  git(["add", "-A"], dir);
  git(["commit", "-m", "base"], dir);
  return dir;
};

describe("B1: story.test_command ignored", () => {
  let dir: string;

  beforeEach(() => {
    vi.resetModules();
    piCalls.prompts.length = 0;
    dir = initRepo();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("worker prompt uses sprint testCommand, never story.test_command", async () => {
    const { runSprint } = await import("../src/index.js");
    const sprint: Sprint = {
      base_branch: "main",
      staging_branch: "staging-b1",
      test_command: "npm test",
      stories: [
        {
          id: "b1",
          title: "B1 guard",
          body: "test",
          // This story-level override must be ignored by the Line.
          test_command: "INJECTED_COMMAND_MUST_NOT_APPEAR",
        },
      ],
    };

    await runSprint(sprint, { repoCwd: dir });

    // The worker prompt (first pi call) must NOT contain the story-injected command.
    const workerPromptText = piCalls.prompts[0] ?? "";
    expect(workerPromptText).not.toContain("INJECTED_COMMAND_MUST_NOT_APPEAR");
    // It MUST contain the sprint-level testCommand.
    expect(workerPromptText).toContain("npm test");
  }, 20_000);
});

describe("B2: acceptance script inside storyCwd mount", () => {
  let dir: string;

  beforeEach(() => {
    vi.resetModules();
    piCalls.prompts.length = 0;
    dir = initRepo();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("acceptPath is under storyCwd so the script is reachable at /work/<rel> in the container", async () => {
    const { runSprint } = await import("../src/index.js");
    const sprint: Sprint = {
      base_branch: "main",
      staging_branch: "staging-b2",
      test_command: "exit 0",
      stories: [{ id: "b2", title: "B2 guard", body: "test" }],
    };

    const state = await runSprint(sprint, { repoCwd: dir });

    // Story must have succeeded (merged) — if the script were outside the mount
    // the sandbox mock would have returned rejected: true, leading to needs_human.
    expect(state.stories.b2?.status).toBe("merged");

    // The acceptance script must exist under storyCwd/.pi-team-lean/acceptance/.
    const expectedPath = join(dir, ".pi-team-lean", "acceptance", "b2.sh");
    expect(existsSync(expectedPath)).toBe(true);
    // And NOT only under the repoCwd-derived acceptance dir
    // (they're the same for non-repo_path stories, which is fine — the important
    // invariant is that it's reachable inside the mount, i.e. under storyCwd).
    expect(expectedPath.startsWith(dir)).toBe(true);
  }, 20_000);
});
