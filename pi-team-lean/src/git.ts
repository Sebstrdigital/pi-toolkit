import { execFileSync } from "node:child_process";

const GIT_TIMEOUT_MS = 120_000;

const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: GIT_TIMEOUT_MS }).trim();

const tryGit = (args: string[], cwd: string): { ok: boolean; out: string } => {
  try {
    return { ok: true, out: git(args, cwd) };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; message?: string };
    return { ok: false, out: err.stderr?.toString() ?? err.message ?? "" };
  }
};

export const ensureCleanTree = (cwd: string): void => {
  const dirty = git(["status", "--porcelain"], cwd);
  if (dirty) throw new Error(`Working tree not clean:\n${dirty}`);
};

export const currentBranch = (cwd: string): string => git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);

export const checkout = (branch: string, cwd: string): void => {
  git(["checkout", branch], cwd);
};

export const cutBranch = (newBranch: string, fromBranch: string, cwd: string): void => {
  git(["checkout", fromBranch], cwd);
  git(["checkout", "-b", newBranch], cwd);
};

export const branchExists = (branch: string, cwd: string): boolean =>
  tryGit(["rev-parse", "--verify", `refs/heads/${branch}`], cwd).ok;

/**
 * Thrown when the base branch cannot be fetched from origin (credential/network
 * failure). The caller parks the story with a clear infra reason rather than
 * silently building on a stale local base — the exact cascade that parked
 * nettobrand#29 (the factory's git token was stripped, the nested submodule
 * fetch failed with "Invalid username or token", and the Line built stale).
 */
export class FetchError extends Error {
  constructor(
    readonly baseBranch: string,
    readonly detail: string,
  ) {
    super(`could not fetch '${baseBranch}' from origin: ${detail}`);
    this.name = "FetchError";
  }
}

/**
 * Fetch `baseBranch` from origin so staging is cut from FRESH remote code, and
 * return the ref to cut from. Throws FetchError on a fetch failure (so a
 * credential/network problem parks loudly instead of building stale). Returns
 * `origin/<base>` when the remote ref exists after fetching, else the local base
 * (a repo with no `origin` remote — e.g. a local-only test repo — is left as-is).
 */
export const fetchBaseRef = (baseBranch: string, cwd: string): string => {
  if (!tryGit(["remote", "get-url", "origin"], cwd).ok) return baseBranch;
  const fetched = tryGit(["fetch", "origin", baseBranch], cwd);
  if (!fetched.ok) throw new FetchError(baseBranch, fetched.out.trim().slice(-500));
  return tryGit(["rev-parse", "--verify", `origin/${baseBranch}`], cwd).ok ? `origin/${baseBranch}` : baseBranch;
};

export const mergeNoFf = (sourceBranch: string, intoBranch: string, message: string, cwd: string): void => {
  git(["checkout", intoBranch], cwd);
  git(["merge", "--no-ff", "-m", message, sourceBranch], cwd);
};

export interface MergeOutcome {
  ok: boolean;
  /** True when the failure is a merge conflict (vs. some other git error). */
  conflict: boolean;
  /** git stderr/stdout when ok is false. */
  detail: string;
}

/**
 * Attempt a `--no-ff` merge without throwing. On a conflict (or any other merge
 * failure) the merge is aborted so the working tree is left clean — a conflict
 * is an expected per-story terminal state, never sprint-fatal (the previous bare
 * `mergeNoFf` threw to process.exit(1) and left staging in a MERGING state).
 */
export const tryMergeNoFf = (sourceBranch: string, intoBranch: string, message: string, cwd: string): MergeOutcome => {
  const co = tryGit(["checkout", intoBranch], cwd);
  if (!co.ok) return { ok: false, conflict: false, detail: co.out };
  const m = tryGit(["merge", "--no-ff", "-m", message, sourceBranch], cwd);
  if (m.ok) return { ok: true, conflict: false, detail: "" };
  // Determine whether we are mid-merge (conflict) and abort to restore a clean tree.
  const conflicted = inMergeState(cwd);
  if (conflicted) abortMerge(cwd);
  return { ok: false, conflict: conflicted, detail: m.out };
};

/** True when the repo is mid-merge (MERGE_HEAD present). */
export const inMergeState = (cwd: string): boolean => tryGit(["rev-parse", "--verify", "MERGE_HEAD"], cwd).ok;

/** Abort an in-progress merge; best-effort (no throw). */
export const abortMerge = (cwd: string): void => {
  tryGit(["merge", "--abort"], cwd);
};

/** Hard-reset the current branch to ORIG_HEAD (undo the just-completed merge). */
export const resetToOrigHead = (cwd: string): { ok: boolean; out: string } =>
  tryGit(["reset", "--hard", "ORIG_HEAD"], cwd);

/** Hard-reset the current branch to an explicit commit SHA. */
export const resetHard = (commit: string, cwd: string): { ok: boolean; out: string } =>
  tryGit(["reset", "--hard", commit], cwd);

/** True when `commit` (a sha or ref) is an ancestor of / reachable from `branch`. */
export const isReachableFrom = (commit: string, branch: string, cwd: string): boolean =>
  tryGit(["merge-base", "--is-ancestor", commit, branch], cwd).ok;

/** Delete a local branch (force). Best-effort, no throw. */
export const deleteBranch = (branch: string, cwd: string): { ok: boolean; out: string } =>
  tryGit(["branch", "-D", branch], cwd);

export const headSha = (cwd: string, ref = "HEAD"): string => git(["rev-parse", ref], cwd);

/**
 * Snapshot the tip sha of every local branch — used to assert, after the worker
 * runs, that ONLY the feature branch advanced (worker-commit-guard-fragile).
 */
export const localBranchHeads = (cwd: string): Record<string, string> => {
  const r = tryGit(["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads"], cwd);
  const out: Record<string, string> = {};
  if (!r.ok) return out;
  for (const line of r.out.split("\n")) {
    const sp = line.indexOf(" ");
    if (sp <= 0) continue;
    out[line.slice(0, sp)] = line.slice(sp + 1).trim();
  }
  return out;
};

export const commitsOnBranch = (branch: string, sinceBranch: string, cwd: string): string[] => {
  const r = tryGit(["log", `${sinceBranch}..${branch}`, "--format=%H"], cwd);
  return r.ok && r.out ? r.out.split("\n") : [];
};

export const diffBetween = (fromBranch: string, toBranch: string, cwd: string): string => {
  const r = tryGit(["diff", `${fromBranch}...${toBranch}`], cwd);
  return r.ok ? r.out : "";
};
