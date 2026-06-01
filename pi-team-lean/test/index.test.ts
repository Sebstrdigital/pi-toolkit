import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sprint } from "../src/types.js";

const piCalls = vi.hoisted(() => new Map<string, number>());

vi.mock("../src/pi.js", async () => {
  return {
    DEFAULT_GATE_TIMEOUT_MS: 600_000,
    runPi: async (_prompt: string, cwd: string) => {
      const { execFileSync: execGit } = await import("node:child_process");
      const count = piCalls.get(cwd) ?? 0;
      piCalls.set(cwd, count + 1);
      if (count === 0) {
        execGit("sh", ["-c", "printf 'worker\\n' >> worker.txt && git add worker.txt && git commit -m worker"], {
          cwd,
          encoding: "utf8",
        });
        return { exitCode: 0, stdout: "worker committed", stderr: "", timedOut: false };
      }
      return { exitCode: 0, stdout: "#!/bin/sh\nexit 0\n", stderr: "", timedOut: false };
    },
  };
});

const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const initRepo = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "ptl-index-"));
  git(["init", "-q", "-b", "main"], dir);
  git(["config", "user.email", "t@t.t"], dir);
  git(["config", "user.name", "t"], dir);
  writeFileSync(join(dir, ".gitignore"), ".pi-team-lean/\n");
  writeFileSync(join(dir, "base.txt"), "base\n");
  git(["add", "-A"], dir);
  git(["commit", "-m", "base"], dir);
  return dir;
};

describe("runStory fix-forward guards", () => {
  let dir: string;

  beforeEach(() => {
    vi.resetModules();
    piCalls.clear();
    dir = initRepo();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runTestCommand-timeout→park", async () => {
    const { runSprint } = await import("../src/index.js");
    const sprint: Sprint = {
      base_branch: "main",
      staging_branch: "staging-timeout",
      max_iterations: 1,
      test_timeout_min: 0.001,
      test_command: "node -e \"setTimeout(()=>{}, 30000)\"",
      stories: [{ id: "s1", title: "timeout", body: "" }],
    };

    const state = await runSprint(sprint, { repoCwd: dir });

    expect(state.stories.s1?.status).toBe("needs_human");
    expect(state.stories.s1?.failure_reason).toMatch(/test_command timed out/i);
  }, 15_000);

  it("post-merge-revert-to-captured-SHA", async () => {
    const { runSprint } = await import("../src/index.js");
    const sprint: Sprint = {
      base_branch: "main",
      staging_branch: "staging-postmerge",
      max_iterations: 1,
      test_command:
        "if [ \"$(git rev-parse --abbrev-ref HEAD)\" = \"staging-postmerge\" ]; then " +
        "printf 'bad\\n' > postmerge.txt && git add postmerge.txt && git commit -m postmerge-touch && exit 1; " +
        "fi; exit 0",
      stories: [{ id: "s2", title: "postmerge", body: "" }],
    };

    const state = await runSprint(sprint, { repoCwd: dir });

    expect(state.stories.s2?.status).toBe("needs_human");
    expect(state.stories.s2?.failure_reason).toMatch(/post-merge verify failed/i);
    expect(git(["rev-parse", "staging-postmerge"], dir)).toBe(git(["rev-parse", "main"], dir));
  }, 15_000);
});

describe("runTestCommand", () => {
  it("returns a typed timeout result", async () => {
    const { runTestCommand } = await import("../src/index.js");
    const result = runTestCommand("node -e \"setTimeout(()=>{}, 30000)\"", process.cwd(), 50);
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  }, 10_000);
});
