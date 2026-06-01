import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  tryMergeNoFf,
  cutBranch,
  checkout,
  branchExists,
  inMergeState,
  isReachableFrom,
  deleteBranch,
  localBranchHeads,
  resetToOrigHead,
  headSha,
} from "../src/git.js";

const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const commit = (cwd: string, file: string, content: string, msg: string): void => {
  writeFileSync(join(cwd, file), content);
  git(["add", "-A"], cwd);
  git(["commit", "-m", msg], cwd);
};

describe("git merge safety", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ptl-git-"));
    git(["init", "-q", "-b", "main"], dir);
    git(["config", "user.email", "t@t.t"], dir);
    git(["config", "user.name", "t"], dir);
    commit(dir, "base.txt", "base\n", "base");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("tryMergeNoFf merges cleanly on non-overlapping changes", () => {
    cutBranch("staging", "main", dir);
    cutBranch("feature", "staging", dir);
    commit(dir, "feature.txt", "feat\n", "feat");
    const r = tryMergeNoFf("feature", "staging", "merge feature", dir);
    expect(r.ok).toBe(true);
    expect(r.conflict).toBe(false);
    expect(inMergeState(dir)).toBe(false);
  });

  it("tryMergeNoFf aborts and reports conflict on overlapping edits, leaving a clean tree", () => {
    cutBranch("staging", "main", dir);
    // story A: edit shared line on staging
    commit(dir, "shared.txt", "A-version\n", "A edits shared");
    // story B: branch from main (before A), edit the same file differently
    cutBranch("feature-b", "main", dir);
    commit(dir, "shared.txt", "B-version\n", "B edits shared");
    const r = tryMergeNoFf("feature-b", "staging", "merge B", dir);
    expect(r.ok).toBe(false);
    expect(r.conflict).toBe(true);
    // CRITICAL: the merge was aborted — tree is clean, NOT mid-merge
    expect(inMergeState(dir)).toBe(false);
    expect(git(["status", "--porcelain"], dir)).toBe("");
  });

  it("isReachableFrom is true for a merged commit and false otherwise", () => {
    cutBranch("staging", "main", dir);
    cutBranch("feature", "staging", dir);
    commit(dir, "f.txt", "f\n", "feat commit");
    const featSha = headSha(dir);
    expect(isReachableFrom(featSha, "staging", dir)).toBe(false);
    tryMergeNoFf("feature", "staging", "merge", dir);
    expect(isReachableFrom(featSha, "staging", dir)).toBe(true);
  });

  it("resetToOrigHead undoes the most recent merge", () => {
    cutBranch("staging", "main", dir);
    const before = (() => {
      checkout("staging", dir);
      return headSha(dir);
    })();
    cutBranch("feature", "staging", dir);
    commit(dir, "f.txt", "f\n", "feat");
    tryMergeNoFf("feature", "staging", "merge", dir);
    expect(headSha(dir)).not.toBe(before);
    const r = resetToOrigHead(dir);
    expect(r.ok).toBe(true);
    expect(headSha(dir)).toBe(before);
  });

  it("deleteBranch removes a leftover feature branch so a re-cut won't FATAL", () => {
    cutBranch("staging", "main", dir);
    cutBranch("pi-team-lean/run/story-1", "staging", dir);
    checkout("staging", dir);
    expect(branchExists("pi-team-lean/run/story-1", dir)).toBe(true);
    deleteBranch("pi-team-lean/run/story-1", dir);
    expect(branchExists("pi-team-lean/run/story-1", dir)).toBe(false);
  });

  it("localBranchHeads snapshots every branch tip", () => {
    cutBranch("staging", "main", dir);
    checkout("main", dir);
    const heads = localBranchHeads(dir);
    expect(Object.keys(heads).sort()).toEqual(["main", "staging"]);
    // advancing one branch changes only its head
    cutBranch("feature", "staging", dir);
    commit(dir, "x.txt", "x\n", "x");
    const after = localBranchHeads(dir);
    expect(after.main).toBe(heads.main);
    expect(after.staging).toBe(heads.staging);
    expect(after.feature).not.toBe(heads.staging);
  });
});
