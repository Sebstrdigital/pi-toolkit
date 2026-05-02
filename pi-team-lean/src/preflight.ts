import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Sprint } from "./types.js";

export interface PreflightCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface PreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
}

const git = (args: string[], cwd: string): { ok: boolean; out: string } => {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { ok: true, out };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message?: string };
    return { ok: false, out: err.stderr?.toString() ?? err.message ?? "" };
  }
};

const REQUIRED_GITIGNORE_ENTRIES = ["pi-team-lean-sprint.json", ".pi-team-lean/"];

export const runPreflight = (repoCwd: string, sprintPath?: string): PreflightResult => {
  const checks: PreflightCheck[] = [];
  let hardFail = false;

  const repo = resolve(repoCwd);

  // 1. Repo exists and is a git repo
  const isRepo = git(["rev-parse", "--is-inside-work-tree"], repo);
  if (!isRepo.ok || isRepo.out !== "true") {
    checks.push({ name: "git-repo", status: "fail", detail: `Not a git repository: ${repo}` });
    return { ok: false, checks };
  }
  checks.push({ name: "git-repo", status: "pass", detail: repo });

  // 2. Clean working tree
  const dirty = git(["status", "--porcelain"], repo);
  if (!dirty.ok) {
    checks.push({ name: "clean-tree", status: "fail", detail: `git status failed: ${dirty.out}` });
    hardFail = true;
  } else if (dirty.out) {
    checks.push({
      name: "clean-tree",
      status: "fail",
      detail: `Working tree dirty:\n${dirty.out}`,
    });
    hardFail = true;
  } else {
    checks.push({ name: "clean-tree", status: "pass", detail: "clean" });
  }

  // 3. Sprint file exists + parses
  const resolvedSprintPath = sprintPath
    ? resolve(sprintPath)
    : join(repo, "pi-team-lean-sprint.json");
  if (!existsSync(resolvedSprintPath)) {
    checks.push({
      name: "sprint-file",
      status: "fail",
      detail: `Sprint file not found: ${resolvedSprintPath}`,
    });
    hardFail = true;
  } else {
    let sprint: Sprint | undefined;
    try {
      sprint = JSON.parse(readFileSync(resolvedSprintPath, "utf8")) as Sprint;
      checks.push({ name: "sprint-file", status: "pass", detail: resolvedSprintPath });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({
        name: "sprint-file",
        status: "fail",
        detail: `Sprint JSON unparseable: ${msg}`,
      });
      hardFail = true;
    }

    // 4. Sprint has stories
    if (sprint) {
      if (!Array.isArray(sprint.stories) || sprint.stories.length === 0) {
        checks.push({
          name: "sprint-stories",
          status: "fail",
          detail: "Sprint has no stories",
        });
        hardFail = true;
      } else {
        checks.push({
          name: "sprint-stories",
          status: "pass",
          detail: `${sprint.stories.length} stories`,
        });
      }

      // 5. Base branch exists
      const baseBranch = sprint.base_branch ?? "main";
      const baseExists = git(["rev-parse", "--verify", `refs/heads/${baseBranch}`], repo);
      if (!baseExists.ok) {
        checks.push({
          name: "base-branch",
          status: "fail",
          detail: `Base branch not found: ${baseBranch}`,
        });
        hardFail = true;
      } else {
        checks.push({ name: "base-branch", status: "pass", detail: baseBranch });
      }

      // 6. Test command present (warn-only)
      if (!sprint.test_command && !sprint.stories.every((s) => s.test_command)) {
        checks.push({
          name: "test-command",
          status: "warn",
          detail: "No sprint.test_command and not all stories define test_command",
        });
      } else {
        checks.push({ name: "test-command", status: "pass", detail: "configured" });
      }
    }
  }

  // 7. .gitignore entries (warn-only) — use git check-ignore so glob patterns count
  const missing = REQUIRED_GITIGNORE_ENTRIES.filter((entry) => {
    const r = git(["check-ignore", "-q", entry], repo);
    return !r.ok;
  });
  if (missing.length > 0) {
    checks.push({
      name: "gitignore",
      status: "warn",
      detail: `Not ignored: ${missing.join(", ")}`,
    });
  } else {
    checks.push({ name: "gitignore", status: "pass", detail: "complete" });
  }

  return { ok: !hardFail, checks };
};

export const formatPreflight = (result: PreflightResult): string => {
  const lines: string[] = [];
  for (const c of result.checks) {
    const icon = c.status === "pass" ? "PASS" : c.status === "warn" ? "WARN" : "FAIL";
    lines.push(`  [${icon}] ${c.name.padEnd(16)} ${c.detail}`);
  }
  lines.push("");
  lines.push(result.ok ? "Preflight: OK" : "Preflight: FAIL");
  return lines.join("\n");
};

export const cliPreflight = (argv: string[]): number => {
  const repoArg = argv[0];
  if (!repoArg) {
    console.error("Usage: pi-team-lean check <repo> [--sprint <path>]");
    return 2;
  }
  const sprintIdx = argv.indexOf("--sprint");
  const sprintPath = sprintIdx > 0 ? argv[sprintIdx + 1] : undefined;
  const result = runPreflight(repoArg, sprintPath);
  console.log(formatPreflight(result));
  return result.ok ? 0 : 1;
};
