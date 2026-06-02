/**
 * robust-b.test.ts — tests for Cluster B hardening items.
 *
 * B1: story.test_command is never passed to the worker prompt or runTestCommand.
 * B3: pi.ts output cap — appendCapped keeps the tail and never exceeds OUTPUT_CAP_BYTES.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

// ─── B1: integration via runSprint ────────────────────────────────────────────

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
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
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
