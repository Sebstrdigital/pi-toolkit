import { execFileSync } from "node:child_process";

const git = (args: string[], cwd: string): string =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

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

export const mergeNoFf = (sourceBranch: string, intoBranch: string, message: string, cwd: string): void => {
  git(["checkout", intoBranch], cwd);
  git(["merge", "--no-ff", "-m", message, sourceBranch], cwd);
};

export const headSha = (cwd: string): string => git(["rev-parse", "HEAD"], cwd);

export const commitsOnBranch = (branch: string, sinceBranch: string, cwd: string): string[] => {
  const r = tryGit(["log", `${sinceBranch}..${branch}`, "--format=%H"], cwd);
  return r.ok && r.out ? r.out.split("\n") : [];
};

export const diffBetween = (fromBranch: string, toBranch: string, cwd: string): string => {
  const r = tryGit(["diff", `${fromBranch}...${toBranch}`], cwd);
  return r.ok ? r.out : "";
};
